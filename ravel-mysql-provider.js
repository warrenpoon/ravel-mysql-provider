'use strict';

const mysql = require('mysql');
const Ravel = require('ravel');

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

  start() {
    this.pool = mysql.createPool({
      host     : Ravel.get(`${this.name} host`),
      port     : Ravel.get(`${this.name} port`),
      user     : Ravel.get(`${this.name} user`),
      password : Ravel.get(`${this.name} password`),
      database : Ravel.get(`${this.name} database name`),
      connectionLimit : Ravel.get(`${this.name} connection pool size`),
      supportBigNumbers : true
    });
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
              connection.release();
            } else {
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
          connection.release();
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
              connection.release();
              log.error(commitErr);
              reject(rollbackErr?rollbackErr:commitErr);
            });
          } else {
            connection.release();
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
  ravelInstance.registerSimpleParameter(`${instance} host`, true);
  ravelInstance.registerSimpleParameter(`${instance} port`, true);
  ravelInstance.registerSimpleParameter(`${instance} user`, true);
  ravelInstance.registerSimpleParameter(`${instance} password`, true);
  ravelInstance.registerSimpleParameter(`${instance} database instance`, true);
  ravelInstance.registerSimpleParameter(`${instance} connection pool size`, true);

  ravelInstance.on('start', () => {
    ravelInstance.Log.debug(`Using mysql database provider, alias: ${instance}`);
    mysqlProvider.start();
  });

  ravelInstance.on('end', () => {
    ravelInstance.Log.debug(`Shutting down mysql database provider, alias: ${instance}`);
    mysqlProvider.end();
  });
};
