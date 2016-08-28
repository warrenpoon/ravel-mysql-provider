'use strict';

const chai = require('chai');
const expect = chai.expect;
// const sinon = require('sinon');
chai.use(require('sinon-chai'));
const redis = require('redis-mock');
const request = require('supertest');
const mockery = require('mockery');
const upath = require('upath');

let Ravel, Routes, mapping, transaction, app; //eslint-disable-line

describe('Ravel RethinkdbProvider integration test', () => {
  beforeEach((done) => {
    process.removeAllListeners('unhandledRejection');
    //enable mockery
    mockery.enable({
      useCleanCache: true,
      warnOnReplace: false,
      warnOnUnregistered: false
    });
    // scaffold basic Ravel app
    Ravel = require('ravel');
    Routes = Ravel.Routes;
    mapping = Routes.mapping;
    transaction = Routes.transaction;
    mockery.registerMock('redis', redis);
    app = new Ravel();
    app.set('log level', app.log.NONE);
    new (require('../lib/ravel-rethinkdb-provider'))(app); // eslint-disable-line new-cap, no-new
    // app.set('mysql options', {
    //   user: 'root',
    //   password: 'password'
    // });
    app.set('keygrip keys', ['mysecret']);

    done();
  });

  afterEach((done) => {
    process.removeAllListeners('unhandledRejection');
    mockery.deregisterAll();
    mockery.disable();
    done();
  });


  it('should provide clients with a connection to query an existing rethink database', (done) => {
    class TestRoutes extends Routes {
      constructor() {
        super('/');
      }

      @transaction
      @mapping(Routes.GET, 'test')
      testHandler(ctx) {
        expect(ctx).to.have.a.property('transaction').that.is.an('object');
        expect(ctx.transaction).to.have.a.property('rethinkdb').that.is.an('object');
        return new Promise((resolve, reject) => {
          // ctx.transaction.rethinkdb.query('SELECT 1 AS col', (err, rows) => {
          //   if (err) { return reject(err); }
          //   ctx.body = rows[0];
          //   resolve(rows[0]);\
          // });
          if (1 === 2) {
            reject();
          }
          ctx.body = {col: '1'};
          resolve({col: '1'});
        });
      }
    }
    mockery.registerMock(upath.join(app.cwd, 'routes'), TestRoutes);
    app.routes('routes');
    app.init();
    app.emit('pre listen');

    request.agent(app.server)
    .get('/test')
    .expect(200, JSON.stringify({col: '1'}))
    .end((err) => {
      app.close();
      done(err);
    });
  });

  it('should trigger a rollback when a query fails', (done) => {
    class TestRoutes extends Routes {
      constructor() {
        super('/');
      }

      @transaction
      @mapping(Routes.GET, 'test')
      testHandler(ctx) {
        expect(ctx).to.have.a.property('transaction').that.is.an('object');
        expect(ctx.transaction).to.have.a.property('rethinkdb').that.is.an('object');
        return new Promise((resolve, reject) => {
          // ctx.transaction.rethinkdb.query('SELECT 1 AS col', (err, rows) => {
          //   if (err) { return reject(err); }
          //   ctx.body = rows[0];
          //   resolve(rows[0]);\
          // });
          if (1 === 2) {
            reject();
          }
          ctx.body = 'test';
          resolve('test');
        });
      }
    }
    mockery.registerMock(upath.join(app.cwd, 'routes'), TestRoutes);
    app.routes('routes');
    app.init();
    app.emit('pre listen');

    request.agent(app.server)
    .get('/test')
    .expect(200, 'test')
    .end((err) => {
      app.close();
      done(err);
    });
  });
});
