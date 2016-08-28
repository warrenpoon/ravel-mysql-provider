'use strict';

const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-as-promised'));
const sinon = require('sinon');
chai.use(require('sinon-chai'));
const mockery = require('mockery');
const redis = require('redis-mock');

let Ravel, app;

describe('Ravel RethinkDB', () => {
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


  describe('#getTransactionConnection()', () => {
    it('should resolve with a connection', () => {
      const provider = new (require('../lib/ravel-rethinkdb-provider'))(app);
      app.init();

      provider.prelisten(app);
      return provider.getTransactionConnection().then((c) => {
        expect(c).to.have.a.property('open').to.equal(true);
        provider.exitTransaction(c);
        app.close();
      });
    });

    it('should reject when a connection cannot be obtained', (done) => {
      const provider = new (require('../lib/ravel-rethinkdb-provider'))(app);
      const connectError = new Error();
      const rethinkdb = {
        connect: () => connectError,
      };
      mockery.registerMock('rethinkdb', rethinkdb);
      app.init();

      expect(provider.getTransactionConnection()).to.be.rejectedWith(connectError);
      app.close();
      done();
    });
  });

  describe('#exitTransaction()', () => {
    it('should reject when a connection cannot be closed', (done) => {
      const provider = new (require('../lib/ravel-rethinkdb-provider'))(app);
      const connectError = new Error();
      const connection = {
        close: () => {
          throw connectError;
        }
      };
      app.init();

      expect(provider.exitTransaction(connection)).to.be.rejectedWith(connectError);
      app.close();
      done();
    });

    it('should close the connection when we exit', (done) => {
      const provider = new (require('../lib/ravel-rethinkdb-provider'))(app);
      app.init();
      const connection = {
        close: () => true
      };
      const closeSpy = sinon.spy(connection, 'close');

      provider.exitTransaction(connection);
      expect(closeSpy).to.have.been.called;
      app.close();
      done();
    });
  });
});
