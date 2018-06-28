describe('Ravel MySQLProvider integration test', () => {
  let Ravel, Routes, mapping, transaction, app;

  beforeEach(async () => {
    // scaffold basic Ravel app
    Ravel = require('ravel');
    Routes = Ravel.Routes;
    mapping = Routes.mapping;
    transaction = Routes.transaction;
    app = new Ravel();
    app.set('port', Math.floor(Math.random() * 10000) + 10000);
    app.set('log level', app.$log.NONE);
    app.registerProvider(require('../../lib/ravel-mysql-provider'));
    app.set('mysql options', {
      user: 'root',
      password: 'password',
      port: 13306
    });
    app.set('keygrip keys', ['mysecret']);

    @Ravel.Module('dal')
    @transaction
    @Ravel.autoinject('$db')
    class TestModule {
      @Ravel.Module.prelisten
      init () {
        return this.$db.scoped('mysql', async function (ctx) {
          await new Promise((resolve, reject) => {
            ctx.transaction.mysql.query('DROP TABLE IF EXISTS mysql.test', (err, rows) => {
              if (err) { return reject(err); }
              resolve(rows);
            });
          });
          await new Promise((resolve, reject) => {
            ctx.transaction.mysql.query('CREATE TABLE mysql.test (id INT)', (err, rows) => {
              if (err) { return reject(err); }
              resolve(rows);
            });
          });
        });
      }

      retrieve (ctx) {
        return new Promise((resolve, reject) => {
          ctx.transaction.mysql.query('SELECT * from mysql.test', (err, rows) => {
            if (err) { return reject(err); }
            ctx.body = rows;
            resolve(rows);
          });
        });
      }

      insert (ctx) {
        return new Promise((resolve, reject) => {
          ctx.transaction.mysql.query('INSERT INTO mysql.test VALUES (1)', (err, rows) => {
            if (err) { return reject(err); }
            ctx.body = rows;
            resolve(rows[0]);
          });
        });
      }

      update (ctx) {
        return new Promise((resolve, reject) => {
          ctx.transaction.mysql.query('UPDATE mysql.test SET ID = :id', {id: 2}, (err, rows) => {
            if (err) { return reject(err); }
            ctx.body = rows;
            resolve(rows[0]);
          });
        });
      }
    }

    @Routes('/')
    @transaction
    @Ravel.autoinject('dal')
    class TestRoutes {
      @mapping(Routes.GET, 'ids')
      async getIds (ctx) {
        await this.dal.retrieve(ctx);
      }

      @mapping(Routes.POST, 'error')
      async postError (ctx) {
        await this.dal.insert(ctx);
        throw new Error();
      }

      @mapping(Routes.POST, 'commit')
      async postCommit (ctx) {
        await this.dal.insert(ctx);
      }

      @mapping(Routes.PUT, 'update')
      async putCommit (ctx) {
        await this.dal.update(ctx);
      }
    }
    app.load(TestModule, TestRoutes);
  });

  afterEach(async () => {
    await app.close();
  });

  it('should provide clients with a connection to query an existing MySQL database', async () => {
    await app.init();
    await app.listen();
    await sleep(1000);
    await request(app.callback)
      .get('/ids')
      .expect(200, JSON.stringify([]));
  });

  it('should trigger a rollback when a query fails', async () => {
    await app.init();
    await app.listen();
    await sleep(1000);
    await request(app.callback).post('/error').expect(500);
    await request(app.callback)
      .get('/ids')
      .expect(200, JSON.stringify([]));
  });

  it('should commit when a query succeeds', async () => {
    await app.init();
    await app.listen();
    await sleep(1000);
    await request(app.callback).post('/commit').expect(201);
    await request(app.callback)
      .get('/ids')
      .expect(200, JSON.stringify([{'id': 1}]));
  });

  it('should allow the use of custom query formats', async () => {
    await app.init();
    await app.listen();
    await sleep(1000);
    await request(app.callback).post('/commit').expect(201);
    await request(app.callback).put('/update').expect(200);
    await request(app.callback)
      .get('/ids')
      .expect(200, JSON.stringify([{'id': 2}]));
  });
});
