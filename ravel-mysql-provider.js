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
  }

  end() {
    if (this.pool) {
      this.pool.end();
    }
  }

  getTransactionConnection() {
    return new Promise((resolve, reject) => {
      this.pool.getConnection(function(connectionErr, connection) {
        if (connectionErr) {
          reject(connectionErr);
        } else {
          connection.beginTransaction(function(transactionErr) {
            if (transactionErr) {
              reject(transactionErr);
              try { connection.release(); } catch(e) { /* do nothing */ }
            } else {
              // add custom format parser
              connection.config.queryFormat = function (query, values) {
                if (!values) return query;
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
    const log = this.log;
    return new Promise((resolve, reject) => {
      if (!shouldCommit) {
        connection.rollback(function(rollbackErr) {
          try { connection.release(); } catch(e) { /* do nothing */ }
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
              try { connection.release(); } catch(e) { /* do nothing */ }
              log.error(commitErr);
              reject(rollbackErr?rollbackErr:commitErr);
            });
          } else {
            try { connection.release(); } catch(e) { /* do nothing */ }
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
    ravelInstance.Log.debug(`Using mysql database provider, alias: ${instance}`);
    try {
      mysqlProvider.start(ravelInstance);
    } catch (err) {
      // EventEmitter swallows error otherwise
      console.error(err.stack);
      process.exit(1);
    }
  });

  ravelInstance.once('end', () => {
    ravelInstance.Log.debug(`Shutting down mysql database provider, alias: ${instance}`);
    mysqlProvider.end(ravelInstance);
  });
};
