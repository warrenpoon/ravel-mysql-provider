'use strict';

const chai = require('chai');
// const expect = chai.expect;
chai.use(require('chai-as-promised'));
// const sinon = require('sinon');
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


  describe('#prelisten()', () => {
    it('skrr skrrr', (done) => {
      const provider = new (require('../lib/ravel-rethinkdb-provider'))(app);
      // app.set('mysql options', {
      //   user: 'root',
      //   password: 'password'
      // });
      app.init();

      provider.prelisten(app);
      // expect(provider.pool).to.be.an.object;
      // expect(provider.pool).to.have.a.property('acquire').which.is.a.function;
      // expect(provider.pool).to.have.a.property('release').which.is.a.function;
      // expect(provider.pool).to.have.a.property('destroy').which.is.a.function;
      app.close();
      done();
    });
  });
});
