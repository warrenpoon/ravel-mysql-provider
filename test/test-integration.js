'use strict';

const chai = require('chai');
// const expect = chai.expect;
// const sinon = require('sinon');
chai.use(require('sinon-chai'));
const redis = require('redis-mock');
// const request = require('supertest');
const mockery = require('mockery');
// const upath = require('upath');

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
    // app.set('keygrip keys', ['mysecret']);

    done();
  });

  afterEach((done) => {
    process.removeAllListeners('unhandledRejection');
    mockery.deregisterAll();
    mockery.disable();
    done();
  });
});
