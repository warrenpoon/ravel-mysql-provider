# ravel-rethinkdb-provider

> Ravel DatabaseProvider for RethinkDB

## Example usage:

*app.js*
```javascript
const app = new require('ravel')();
const RethinkDBProvider = require('ravel-rethinkdb-provider')(app);
new RethinkDBProvider(app);

// ... the rest of your Ravel app
```
