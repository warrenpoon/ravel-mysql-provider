# ravel-mysql-provider

> Ravel DatabaseProvider for MySQL

## Example usage:

*app.js*
```javascript
const app = new require('ravel')();
require('ravel-mysql-provider')(app);

// ... the rest of your Ravel app
```

## Configuration

Requiring the `ravel-mysql-provider` module will register a configuration parameter with Ravel which must be supplied via `.ravelrc` or `app.set()`:

*.ravelrc*
```json
{
  "mysql options": {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "a password",
    "database": "mydatabase",
    "idleTimeoutMillis": 5000,
    "connectionLimit": 10
  }
}
```

All options for a `node-mysql` connection are supported, and are documented [here](https://github.com/felixge/node-mysql#establishing-connections). Additionally, the `connectionLimit` parameter controls the size of the underlying connection pool, while `idleTimeoutMillis` controls how long connections will remain idle in the pool before being destroyed. It is vital that you make `idleTimeoutMillis` shorter than the `wait_timeout` set in your mysql configuration `my.cnf`, otherwise you you might have timed-out connections sitting in your pool. Note: `idleTimeoutMillis` is specified in milliseconds, while `wait_timeout` is specified in seconds.

## Multiple Simultaneous Providers

`ravel-mysql-provider` also supports multiple simultaneous pools for different mysql databases, as long as you name them:

*app.js*
```javascript
const app = new require('ravel')();
require('ravel-mysql-provider')(app, 'first mysql');
require('ravel-mysql-provider')(app, 'second mysql');
//...
```

*.ravelrc*
```json
{
  "first mysql options": {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "a password",
    "database": "myfirstdatabase",
    "idleTimeoutMillis": 5000,
    "connectionLimit": 10
  },
  "second mysql options": {
    "host": "localhost",
    "port": 3307,
    "user": "root",
    "password": "another password",
    "database": "myseconddatabase",
    "idleTimeoutMillis": 5000,
    "connectionLimit": 10
  }
}
```
