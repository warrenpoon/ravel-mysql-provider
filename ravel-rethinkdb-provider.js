'use strict';

const rethinkdb = require('rethinkdb');
const Ravel = require('ravel');

/**
 * Default options for rethinkdb
 */
const DEFAULT_OPTIONS = {
  host: 'localhost',
  port: 28015,
  db: 'test',
  user: 'admin',
  password: '',
  timeout: 20,
  ssl: {}
};

/**
 * A Ravel DatabaseProvider for rethinkdb
 */
class RethinkdbProvider extends Ravel.DatabaseProvider {
  /**
   * @param {Ravel} ravelInstance an instance of a Ravel application
   * @param ${String} instanceName the name to alias this rethinkdbProvider under. 'rethinkdb' by default.
   */
  constructor(ravelInstance, instanceName = 'rethinkdb') {
    super(ravelInstance, instanceName);
    ravelInstance.registerParameter(`${instanceName} options`, true, DEFAULT_OPTIONS);
  }

  prelisten(ravelInstance) {
    // overlay user options onto defaults
    const ops = {};
    Object.assign(ops, DEFAULT_OPTIONS);
    Object.assign(ops, ravelInstance.get(`${this.name} options`));

    this.connectionOptions = ops;
  }

  getTransactionConnection() {
    return new Promise((resolve, reject) => {
      rethinkdb.connect(this.ops, function(connectionErr, connection) {
        if (connectionErr) {
          reject(connectionErr);
        } else {
          resolve(connection);
        }
      });
    });
  }

  /**
     * End a transaction and close the connection.
     * Rollback the transaction iff finalErr !== null.
     *
     * @param {Object} connection A connection object which was used throughout the transaction
     * @param {Boolean} shouldCommit If true, commit, otherwise rollback.  This provider does not support rollback.
     * @return {Promise} resolved, or rejected if there was an error while closing the connection.
     */
  exitTransaction(connection/*, shouldCommit*/) {
    return new Promise((resolve, reject) => {
      try {
        connection.close();
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = RethinkdbProvider;
