'use strict';

const mysql = require('mysql');
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
  connectionLimit: 10
};

/**
 * A Ravel DatabaseProvider for MySQL
 */
class MySQLProvider extends Ravel.DatabaseProvider {
  /**
   * Construct a new MySQLProvider.
   *
   * @param {Ravel} ravelInstance - An instance of a Ravel application.
   * @param {string} instanceName - The name to alias this MySQLProvider under. 'mysql' by default.
   */
  constructor (ravelInstance, instanceName = 'mysql') {
    super(ravelInstance, instanceName);

    ravelInstance.registerParameter(`${instanceName} options`, true, DEFAULT_OPTIONS);
  }

  prelisten (ravelInstance) {
    // overlay user options onto defaults
    const ops = {};
    Object.assign(ops, DEFAULT_OPTIONS);
    Object.assign(ops, ravelInstance.get(`${this.name} options`));
    this.pool = mysql.createPool(ops);
  }

  end () {
    if (this.pool) {
      this.pool.end((err) => {
        if (err) this.$log.error(err.stack);
      });
    }
  }

  release (connection, err) {
    // if we know this is a fatal error, don't return the connection to the pool
    if (err && err.fatal) {
      this.$log.trace('Destroying fatally-errored connection.');
      try { connection.destroy(); } catch (e) { /* don't worry about double destroys for now */ }
    } else {
      try { connection.release(); } catch (e) { /* don't worry about double releases for now */ }
    }
  }

  getTransactionConnection () {
    const self = this;
    return new Promise((resolve, reject) => {
      this.pool.getConnection(function (connectionErr, connection) {
        if (connectionErr) {
          return reject(connectionErr);
        }
        // begin transaction
        connection.beginTransaction(function (transactionErr) {
          if (transactionErr) {
            transactionErr.fatal = true;
            reject(transactionErr);
            self.release(connection, transactionErr);
          } else {
            // add custom format parser
            connection.config.queryFormat = function (query, values) {
              if (!values) { return query; }
              // replace :* formatted parameters
              query = query.replace(/:(\w+)/g, function (txt, key) {
                if (values.hasOwnProperty(key)) {
                  return this.escape(values[key]);
                }
                return txt;
              }.bind(connection));
              // regular parsing
              return mysql.format(query, values);
            };
            resolve(connection);
          }
        });
      });
    });
  }

  exitTransaction (connection, shouldCommit) {
    const self = this;
    const log = this.$log;
    return new Promise((resolve, reject) => {
      if (!shouldCommit) {
        connection.rollback((rollbackErr) => {
          self.release(connection, rollbackErr);
          if (rollbackErr) {
            log.trace(rollbackErr);
            reject(rollbackErr);
          } else {
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
                reject(rollbackErr || commitErr);
              });
            } else {
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
