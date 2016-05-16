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
  connectionLimit: 10,
  supportBigNumbers: true,
  bigNumberStrings: true
};

/**
 * A Ravel DatabaseProvider for MySQL
 */
class MySQLProvider extends Ravel.DatabaseProvider {
  /**
   * @param ${String} instanceName the name to alias this MySQLProvider under. 'mysql' by default.
   */
  constructor(instanceName) {
    super(instanceName);
  }

  start(ravelInstance) {
    // overlay user options onto defaults
    const ops = {};
    Object.assign(ops, DEFAULT_OPTIONS);
    Object.assign(ops, ravelInstance.get(`${this.name} options`));
    this.pool = mysql.createPool(ops);

    // override getConnection function so that it always gets a good connection
    const self = this;
    const orig = this.pool.getConnection.bind(this.pool);
    const getConnectionHelper = function(cb, tries) {
      if (tries > ops.connectionLimit+1) {
        cb (new Error(`Could not retrieve a connection for ${self.name}. Maximum retries reached.`));
      } else {
        orig((e, c) => {
          // if we got an error and no connection, cb immediately
          if (e && !c) {
            cb(e);
          } else {
            // otherwise, test connection
            c.ping((pingErr) => {
              if (pingErr) {
                // try again!
                getConnectionHelper(cb, tries+1);
              } else {
                cb(null, c);
              }
            });
          }
        });
      }
    };
    this.pool.getConnection = function(cb) {
      getConnectionHelper(cb, 0);
    };
  }

  end() {
    if (this.pool) {
      this.pool.end();
    }
  }

  release(connection, err) {
    // if we know thisis a fatal error, don't return the connection to the pool
    if (err && err.fatal) {
      try {connection.destroy();} catch (e) { /* don't worry about double destroys*/ }
    } else {
      // check if the connection is still good with a ping and do the right thing
      connection.ping(function (e) {
        if (e && e.fatal) {
          try {connection.destroy();} catch (e2) {/* don't worry about double destroys*/}
        } else {
          try {connection.release();} catch (e2) {/* don't worry about double releases*/}
        }
      });
    }
  }

  getTransactionConnection() {
    const self = this;
    return new Promise((resolve, reject) => {
      this.pool.getConnection(function(connectionErr, connection) {
        if (connectionErr) {
          reject(connectionErr);
        } else {
          // from https://github.com/felixge/node-mysql/issues/832
          const del = connection._protocol._delegateError;
          connection._protocol._delegateError = function(err, sequence){
            if (err.fatal) {
              self.log.trace(`fatal error: ${err.message}`);
            }
            return del.call(this, err, sequence);
          };
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
        connection.rollback(function(rollbackErr) {
          self.release(connection, rollbackErr);
          if (rollbackErr) {
            reject(rollbackErr);
          } else  {
            resolve();
          }
        });
      } else {
        connection.commit(function(commitErr) {
          if (commitErr) {
            connection.rollback(function(rollbackErr){
              self.release(connection, rollbackErr);
              log.error(commitErr);
              reject(rollbackErr?rollbackErr:commitErr);
            });
          } else {
            self.release(connection);
            resolve();
          }
        });
      }
    });
  }
}

/**
 * Add a new MySQLProvider to a Ravel instance
 * More than one can be used at the same time, via the instance argument
 * @param {Object} ravelInstance a reference to a Ravel instance
 * @param {String | undefined} a unique name for this MySQLProvider, if you intend to use more than one simultaneously
 *
 */
module.exports = function(ravelInstance, name) {
  const instance = name ? name.trim() : 'mysql';
  const mysqlProvider = new MySQLProvider(instance);
  // register mysql as a database provider
  const providers = ravelInstance.get('database providers');
  providers.push(mysqlProvider);
  ravelInstance.set('database providers', providers);

  // required mysql parameters
  ravelInstance.registerSimpleParameter(`${instance} options`, true, DEFAULT_OPTIONS);

  ravelInstance.once('pre listen', () => {
    ravelInstance.log.debug(`Using mysql database provider, alias: ${instance}`);
    try {
      mysqlProvider.start(ravelInstance);
    } catch (err) {
      // EventEmitter swallows error otherwise
      console.error(err.stack);
      process.exit(1);
    }
  });

  ravelInstance.once('end', () => {
    ravelInstance.log.debug(`Shutting down mysql database provider, alias: ${instance}`);
    mysqlProvider.end(ravelInstance);
  });
};
