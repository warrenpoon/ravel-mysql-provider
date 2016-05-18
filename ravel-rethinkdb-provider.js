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
   * @param ${String} instanceName the name to alias this rethinkdbProvider under. 'rethinkdb' by default.
   */
  constructor(instanceName) {
    super(instanceName);
  }

  start(ravelInstance) {
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
          this.connection = connection;
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
     * @param {Boolean} shouldCommit If true, commit, otherwise rollback
     * @return {Promise} resolved, or rejected if there was an error while closing the connection.
     */
  exitTransaction(connection, shouldCommit) {  //eslint-disable-line no-unused-vars
    if (this.connection) {
      this.connection.close();
    }
  }
}

/**
 * Add a new RethinkdbProvider to a Ravel instance
 * More than one can be used at the same time, via the instance argument
 * @param {Object} ravelInstance a reference to a Ravel instance
 * @param {String | undefined} a unique name for this rethinkdbProvider, if you intend to use more than one simultaneously
 *
 */
module.exports = function(ravelInstance, name) {
  const instance = name ? name.trim() : 'rethinkdb';
  const rethinkdbProvider = new RethinkdbProvider(instance);
  // register rethinkdb as a database provider
  const providers = ravelInstance.get('database providers');
  providers.push(rethinkdbProvider);
  ravelInstance.set('database providers', providers);

  // required rethinkdb parameters
  ravelInstance.registerSimpleParameter(`${instance} options`, true, DEFAULT_OPTIONS);

  ravelInstance.once('pre listen', () => {
    ravelInstance.log.debug(`Using mysql database provider, alias: ${instance}`);
    try {
      rethinkdbProvider.start(ravelInstance);
    } catch (err) {
      // EventEmitter swallows error otherwise
      console.error(err.stack);
      process.exit(1);
    }
  });
};
