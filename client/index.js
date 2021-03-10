const express = require('express');
const path = require('path');
const PORT = process.env.PORT || 8080;
// import * as config from './config.json'

const app = express();

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, '/public'))

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res, next) => {
  console.log("Starting client")
  res.render('index', { title: "Fablecraft"})
})

app.get('/test', (req, res, next) => {
  res.status(200).send({message: "test successful"})
})

app.listen(PORT, () => {
  console.log('Fablecraft server listening on port ' + PORT + ' in ' + process.env.NODE_ENV + ' mode') 
})
