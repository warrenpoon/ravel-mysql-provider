'use strict';

const mysql = require('mysql');
const Pool = require('generic-pool').Pool;
const Ravel = require('ravel');

/**
 * Default options for node-mysql
 */
const DEFAULT_OPTIONS = {
  host: 'localhost',
  port: 3306,
  database: 'mysql',
  supportBigNumbers: true,
  bigNumberStrings: true,
  connectionLimit: 10,
  idleTimeoutMillis: 30000
};

/**
 * A Ravel DatabaseProvider for MySQL
 * We use generic-pool instead of node-mysql's built-in pool
 * because it's more flexible and less completely insane when
 * it comes to timeouts.
 */
class MySQLProvider extends Ravel.DatabaseProvider {
  /**
   * @param {Ravel} ravelInstance an instance of a Ravel application
   * @param {String} instanceName the name to alias this MySQLProvider under. 'mysql' by default.
   */
  constructor(ravelInstance, instanceName = 'mysql') {
    super(ravelInstance, instanceName);

    ravelInstance.registerParameter(`${instanceName} options`, true, DEFAULT_OPTIONS);
  }

  prelisten(ravelInstance) {
    // overlay user options onto defaults
    const ops = {};
    Object.assign(ops, DEFAULT_OPTIONS);
    Object.assign(ops, ravelInstance.get(`${this.name} options`));
    const pool = new Pool({
      name: `${this.name} pool`,
      create: function(callback) {
        const conn = mysql.createConnection(ops);
        conn.connect((err) =>  {
          if (err) {
            callback(err, null);
          } else {
            callback(null, conn);
          }
        });
        // catch timeouts
        conn.once('error', () => {
          pool.destroy(conn);
        });
      },
      destroy: function(conn) {
        try {conn.destroy();} catch (e) { /* don't worry about destroy failure*/ }
      },
      // this doesn't seem to work properly yet. results in multiple destroys.
      // validateAsync: function(conn, callback) {
      //   conn.ping((err) => {
      //     try {callback(err?true:false);} catch(e) {/* don't worry about double destroys? */}
      //   });
      // },
      min: 2,
      max: ops.connectionLimit,
      idleTimeoutMillis: ops.idleTimeoutMillis
    });
    this.pool = pool;
  }

  end() {
    if (this.pool) {
      this.pool.drain(() => this.pool.destroyAllNow());
    }
  }

  release(connection, err) {
    // if we know this is a fatal error, don't return the connection to the pool
    if (err && err.fatal) {
      this.log.trace('Destroying fatally-errored connection.');
      try {this.pool.destroy(connection);} catch(e) {/*don't worry about double destroys for now*/}
    } else {
      try {this.pool.release(connection);} catch(e) {/*don't worry about double releases for now*/}
    }
  }

  getTransactionConnection() {
    const self = this;
    return new Promise((resolve, reject) => {
      this.pool.acquire(function(connectionErr, connection) {
        if (connectionErr) {
          reject(connectionErr);
        } else {
          // begin transaction
          connection.beginTransaction(function(transactionErr) {
            if (transactionErr) {
              reject(transactionErr);
              self.release(connection, transactionErr);
            } else {
              // add custom format parser
              connection.config.queryFormat = function (query, values) {
                if (!values) {return query;}
                // replace :* formatted parameters
                query = query.replace(/\:(\w+)/g, function (txt, key) {
                  if (values.hasOwnProperty(key)) {
                    return this.escape(values[key]);
                  }
                  return txt;
                }.bind(this));
                // regular parsing
                return mysql.format(query, values);
              };
              resolve(connection);
            }
          });
        }
      });
    });
  }

  exitTransaction(connection, shouldCommit) {
    const self = this;
    const log = this.log;
    return new Promise((resolve, reject) => {
      if (!shouldCommit) {
        connection.rollback((rollbackErr) => {
          self.release(connection, rollbackErr);
          if (rollbackErr) {
            log.trace(rollbackErr);
          } else  {
            resolve();
          }
        });
      } else {
        connection.commit((commitErr) => {
          if (commitErr) {
            log.trace(commitErr);
            if (!commitErr.fatal) {
              connection.rollback((rollbackErr) => {
                self.release(connection, rollbackErr);
                reject(rollbackErr?rollbackErr:commitErr);
              });
            } else  {
              self.release(connection, commitErr);
              reject(commitErr);
            }
          } else {
            self.release(connection);
            resolve();
          }
        });
      }
    });
  }
}

module.exports = MySQLProvider;
