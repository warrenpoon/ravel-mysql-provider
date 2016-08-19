'use strict';

const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-as-promised'));
const sinon = require('sinon');
chai.use(require('sinon-chai'));
const mockery = require('mockery');
const redis = require('redis-mock');

let Ravel, app;

describe('Ravel MySQLProvider', () => {
  beforeEach((done) => {
    process.removeAllListeners('unhandledRejection');
    //enable mockery
    mockery.enable({
      useCleanCache: true,
      warnOnReplace: false,
      warnOnUnregistered: false
    });
    mockery.registerMock('redis', redis);
    Ravel = require('ravel');
    app = new Ravel();
    app.set('log level', app.log.NONE);
    app.set('keygrip keys', ['mysecret']);

    done();
  });

  afterEach((done) => {
    process.removeAllListeners('unhandledRejection');
    mockery.deregisterAll();
    mockery.disable();
    app.close();
    done();
  });


  describe('#prelisten()', () => {
    it('should create a generic pool of connections', (done) => {
      const provider = new (require('../lib/ravel-mysql-provider'))(app);
      app.set('mysql options', {
        user: 'root',
        password: 'password'
      });
      app.init();

      provider.prelisten(app);
      expect(provider.pool).to.be.an.object;
      expect(provider.pool).to.have.a.property('acquire').which.is.a.function;
      expect(provider.pool).to.have.a.property('release').which.is.a.function;
      expect(provider.pool).to.have.a.property('destroy').which.is.a.function;
      app.close();
      done();
    });

    it('should create a pool which destroys connections when they error out', (done) => {
      const EventEmitter = require('events').EventEmitter;
      const conn = new EventEmitter();
      conn.connect = (cb) => cb(new Error());
      const mysql = {
        createConnection: () => conn
      };
      mockery.registerMock('mysql', mysql);

      const provider = new (require('../lib/ravel-mysql-provider'))(app);
      app.set('mysql options', {
        user: 'root',
        password: 'password'
      });
      app.init();

      provider.prelisten(app);
      const spy = sinon.stub(provider.pool, 'destroy');
      conn.emit('error');
      expect(spy).to.have.been.called;
      done();
    });
  });

  describe('#end()', () => {
    it('should drain all connections in the pool', (done) => {
      const provider = new (require('../lib/ravel-mysql-provider'))(app);
      app.set('mysql options', {
        user: 'root',
        password: 'password'
      });
      app.init();

      provider.prelisten(app);
      const drainSpy = sinon.spy(provider.pool, 'drain');

      provider.end();
      app.close();
      expect(drainSpy).to.have.been.called;
      done();
    });

    it('should do nothing when the provider is not initialized', (done) => {
      const provider = new (require('../lib/ravel-mysql-provider'))(app);
      provider.end();
      app.close();
      done();
    });
  });

  describe('#release()', () => {
    it('should release a connection back to the pool if no errors were encountered', (done) => {
      const provider = new (require('../lib/ravel-mysql-provider'))(app);
      app.set('mysql options', {
        user: 'root',
        password: 'password'
      });
      app.init();

      provider.prelisten(app);
      const releaseSpy = sinon.spy(provider.pool, 'release');
      provider.getTransactionConnection().then((conn) => {
        provider.release(conn);
        expect(releaseSpy).to.have.been.called;
        app.close();
        done();
      });
    });

    it('should remove a connection from the pool permanently if fatal errors were encountered', (done) => {
      const provider = new (require('../lib/ravel-mysql-provider'))(app);
      app.set('mysql options', {
        user: 'root',
        password: 'password'
      });
      app.init();

      provider.prelisten(app);
      const destroySpy = sinon.spy(provider.pool, 'destroy');
      provider.getTransactionConnection().then((conn) => {
        const err = new Error();
        err.fatal = true;
        provider.release(conn, err);
        expect(destroySpy).to.have.been.called;
        app.close();
        done();
      });
    });
  });

  describe('#getTransactionConnection()', () => {
    it('should resolve with a connection', () => {
      const provider = new (require('../lib/ravel-mysql-provider'))(app);
      app.set('mysql options', {
        user: 'root',
        password: 'password'
      });
      app.init();

      provider.prelisten(app);
      return provider.getTransactionConnection().then((c) => {
        expect(c).to.have.a.property('query').that.is.a.function;
        provider.release(c);
        provider.end();
        app.close();
      });
    });

    it('should reject when a connection cannot be obtained', (done) => {
      const EventEmitter = require('events').EventEmitter;
      const conn = new EventEmitter();
      const connectError = new Error();
      conn.connect = (cb) => cb(connectError);
      const mysql = {
        createConnection: () => conn
      };
      mockery.registerMock('mysql', mysql);

      const provider = new (require('../lib/ravel-mysql-provider'))(app);
      app.set('mysql options', {
        user: 'root',
        password: 'password'
      });
      app.init();

      provider.prelisten(app);
      expect(provider.getTransactionConnection()).to.be.rejectedWith(connectError);
      app.close();
      done();
    });

    it('should reject when a transaction cannot be opened', (done) => {
      const EventEmitter = require('events').EventEmitter;
      const conn = new EventEmitter();
      const beginTransactionError = new Error();
      conn.connect = (cb) => cb();
      conn.beginTransaction = (cb) => cb(beginTransactionError);
      const mysql = {
        createConnection: () => conn
      };
      mockery.registerMock('mysql', mysql);

      const provider = new (require('../lib/ravel-mysql-provider'))(app);
      provider.pool =  {
        acquire: (cb) => cb(null, conn)
      };

      expect(provider.getTransactionConnection()).to.be.rejectedWith(beginTransactionError);
      done();
    });
  });
});
