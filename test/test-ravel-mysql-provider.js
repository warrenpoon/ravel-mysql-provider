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
    // app.set('log level', app.log.NONE);  this won't work because app.init() is never called in these tests
    app.log.setLevel(app.log.NONE);
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

    it('should resolve with a connection which supports named positional parameters', () => {
      const provider = new (require('../lib/ravel-mysql-provider'))(app);
      app.set('mysql options', {
        user: 'root',
        password: 'password'
      });
      app.init();

      provider.prelisten(app);
      return provider.getTransactionConnection().then((c) => {
        expect(c.config).to.have.a.property('queryFormat').that.is.a.function;
        expect(c.config.queryFormat('UPDATE posts SET title = :title', { title: 'Hello MySQL'})).to.equal('UPDATE posts SET title = \'Hello MySQL\'');
        expect(c.config.queryFormat('UPDATE posts SET title = :schtuff', {})).to.equal('UPDATE posts SET title = :schtuff');
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

  describe('#exitTransaction()', () => {
    var provider, connection;

    beforeEach((done) => {
      connection = {
        commit: (cb) => cb(),
        rollback: (cb) => cb(),
      };
      provider = new (require('../lib/ravel-mysql-provider'))(app);
      provider.pool =  {
        destroy: function() {},
        release: function() {}
      };
      done();
    });

    it('should call commit on the connection, release it and resolve when shouldResolve is true', (done) => {
      const commitStub = sinon.stub(connection, 'commit');
      commitStub.callsArg(0);
      const releaseSpy = sinon.spy(provider.pool, 'release');

      expect(provider.exitTransaction(connection, true)).to.be.fulfilled;
      expect(commitStub).to.have.been.called;
      expect(releaseSpy).to.have.been.called;
      done();
    });

    it('should call commit on the connection, release it and reject when shouldResolve is true and a commit error occurred. should attempt to rollback.', (done) => {
      const commitStub = sinon.stub(connection, 'commit');
      const commitErr = new Error();
      commitStub.callsArgWith(0, commitErr);
      const rollbackStub = sinon.stub(connection, 'rollback');
      rollbackStub.callsArg(0);
      const releaseSpy = sinon.spy(provider.pool, 'release');

      expect(provider.exitTransaction(connection, true)).to.be.rejectedWith(commitErr);
      expect(commitStub).to.have.been.called;
      expect(releaseSpy).to.have.been.called;
      expect(rollbackStub).to.have.been.called;
      done();
    });

    it('should call commit on the connection, release it and reject with a rollback error when shouldResolve is true and a commit error occurred, followed by a rollback error.', (done) => {
      const commitStub = sinon.stub(connection, 'commit');
      const commitErr = new Error();
      commitStub.callsArgWith(0, commitErr);
      const rollbackErr = new Error();
      const rollbackStub = sinon.stub(connection, 'rollback');
      rollbackStub.callsArgWith(0, rollbackErr);
      const releaseSpy = sinon.spy(provider.pool, 'release');

      expect(provider.exitTransaction(connection, true)).to.be.rejectedWith(rollbackErr);
      expect(commitStub).to.have.been.called;
      expect(releaseSpy).to.have.been.called;
      expect(rollbackStub).to.have.been.called;
      done();
    });

    it('should call commit on the connection, destroy it and reject when shouldResolve is true and a fatal commit error occurred', (done) => {
      const commitStub = sinon.stub(connection, 'commit');
      const fatalErr = new Error();
      fatalErr.fatal = true;
      commitStub.callsArgWith(0, fatalErr);
      const destroySpy = sinon.spy(provider.pool, 'destroy');

      expect(provider.exitTransaction(connection, true)).to.be.rejectedWith(fatalErr);
      expect(commitStub).to.have.been.called;
      expect(destroySpy).to.have.been.called;
      done();
    });

    it('should call rollback on the connection, release it and resolve when shouldResolve is false', (done) => {
      const rollbackStub = sinon.stub(connection, 'rollback');
      rollbackStub.callsArg(0);
      const releaseSpy = sinon.spy(provider.pool, 'release');

      expect(provider.exitTransaction(connection, false)).to.be.fulfilled;
      expect(rollbackStub).to.have.been.called;
      expect(releaseSpy).to.have.been.called;
      done();
    });

    it('should call rollback on the connection, release it and reject when shouldResolve is false and a rollback error occurred', (done) => {
      const rollbackStub = sinon.stub(connection, 'rollback');
      const rollbackErr = new Error();
      rollbackStub.callsArgWith(0, rollbackErr);
      const releaseSpy = sinon.spy(provider.pool, 'release');

      expect(provider.exitTransaction(connection, false)).to.be.rejectedWith(rollbackErr);
      expect(rollbackStub).to.have.been.called;
      expect(releaseSpy).to.have.been.called;
      done();
    });

    it('should call rollback on the connection, destroy it and reject when shouldResolve is false and a fatal rollback error occurred', (done) => {
      const rollbackStub = sinon.stub(connection, 'rollback');
      const fatalErr = new Error();
      fatalErr.fatal = true;
      rollbackStub.callsArgWith(0, fatalErr);
      const destroySpy = sinon.spy(provider.pool, 'destroy');

      expect(provider.exitTransaction(connection, false)).to.be.rejectedWith(fatalErr);
      expect(rollbackStub).to.have.been.called;
      expect(destroySpy).to.have.been.called;
      done();
    });
  });
});
