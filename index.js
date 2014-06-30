'use strict';

var os = require('os');
var fs = require('fs');
var assert = require('assert');
var format = require('util').format;
var child_process = require('child_process');
var yaml = require('js-yaml');
var bigint = require('bigint');
var request = require('request');

// using low-level API because the high-level API doesn't work as of v1.0.11
var sodium = require('sodium').api;
var SERVER_KEY = new Buffer('FhMbJE+Cyla045d6y41lHVfEeFieOnLZQod52GXojUw=', 'base64');
var SERVER_URL = 'http://ufoserver.k1773r.darkgamex.ch:8000/getwork';   // POST
var RECONNECT_INTERVAL = 1000;     // ms

var ufos = require('./ufos');
var r_ufos = [], f_ufos = [];


if (process.argv.length !== 3) {
  console.error('No config file specified on command line. Outputting a new one...');
  console.log(yaml.dump(generateNewConfig()));
  process.exit(0);
}

var config = yaml.safeLoad(fs.readFileSync(process.argv[2], 'utf8'));
var nick = config.nick,
    cores = config.cores,
    pubkey = new Buffer(config.pubkey, 'base64'),
    secret = new Buffer(config.secret, 'base64');

var workers = [];     // [ {ecm:<spawned process>, work: {...}}, ...]

var do_exit = false;
process.on('SIGHUP', function(){
  if (workers.length == 0) {
    console.log('Exiting.');
    return process.exit(0);
  }
  console.log('Waiting for %d workers to exit...', workers.length);
  do_exit = true;
});


function getWork(finished_work, num_to_get) {
  assert(finished_work && finished_work.length !== undefined);    // array

  // first, remove finished work from workers array
  var finished_work_ids = finished_work.map(function(w){return w.id;});
  for (var i = workers.length-1; i >= 0; i--) {
    if (finished_work_ids.indexOf(workers[i].work.id) !== -1) {
      workers.splice(i,1);
      break;
    }
  }

  num_to_get = (num_to_get===undefined)? (cores - workers.length) : num_to_get;

  var req = {
    get: num_to_get,
    results: finished_work,
    pending: workers.map(function(worker){return worker.work.id}),
    f: f_ufos.map(function(facs){return facs.length;})
  };
  function attemptLoop() {
    var enc_req = {nick:nick, m:toServer(req)};
    request.post(SERVER_URL, {json: enc_req}, function(err, response, body) {
      function invalid() {
        if (err) {
          console.error("Problem connecting to server: %j; retrying...", err.message);
        } else if (response.statusCode !== 200) {
          console.error("Server responded with HTTP status code %d", response.statusCode);
        } else {
          console.error("Invalid response body: %j; retrying...", body);
        }
        if (response && response.statusCode === 400) {
          console.error('Server thinks something is wrong; exiting.');
          return process.exit(1);
        }
        return setTimeout(attemptLoop, RECONNECT_INTERVAL);
      }
      if (err || response.statusCode !== 200) return invalid();

      if (!body || body.charCodeAt) return invalid(); // if string, invalid JSON

      if (!body.m) return invalid();  // if string, invalid JSON

      var res = fromServer(body.m);
      if (!res) return invalid();   // could not decrypt

      // at this point, we can trust everything in res as coming from server

      var work = res.work,
          factorInfo = res.f;
      if (work.length === 0 && workers.length === 0) {
        if (do_exit) {
          console.log("No work from server; exiting! :-)");
        } else {
          console.log("All done.");
        }
        // print info
        r_ufos.forEach(function(r, ufoIndex) {
          var s = JSON.stringify(f_ufos[ufoIndex].map(function(f){return f.toString();}), null, 2);
          console.log('r_ufos[%d]: ', ufoIndex, s);
        });
        return process.exit(0);
      }

      factorInfo.forEach(updateFactors);

      work.forEach(function(w) {
        startWorker(w);
      });
    });
  }
  attemptLoop();
}


function updateFactors(facsInfo) {
  var ufoIndex = facsInfo.ufo,
      offset = facsInfo.off,
      facs = facsInfo.facs;

  while ((r_ufos.length - 1) < ufoIndex) {
    r_ufos.push(ufos.get(r_ufos.length));
    f_ufos.push([]);
  }
  var u = r_ufos[ufoIndex];
  var f = f_ufos[ufoIndex];

  // This can only fail if more than one client is running
  // for the given nick.
  assert(offset <= f.length);

  facs.forEach(function (fac, i) {
    fac = bigint(fac);
    assert(fac.gt(1));
    assert(fac.lt(u));
    if (i+offset <= f.length-1) {
      // we already have this
      assert(fac.eq(f[i+offset]), format('ufoIndex is %d, fac is %s, f[%d] is %s', ufoIndex, fac, i+offset, f[i+offset]));   // XXX DEBUG
      return;
    }
    var d = u.div(fac);
    assert(fac.mul(d).eq(u));  // is it actually a factor?
    assert(fac.le(d));         // server must give the smaller one
    f.push(fac);
    r_ufos[ufoIndex] = u = d;
  });
}


function startWorker(work) {
  var factor_found = null;
  assert(work);
  assert(work.sigma);
  assert(work.B1);
  assert(work.id !== undefined);
  assert(work.ufo >= 0);
  while ((r_ufos.length - 1) < work.ufo) {
    r_ufos.push(ufos.get(r_ufos.length));
    f_ufos.push([]);
  }
  var ecm = child_process.spawn('ecm', ['-sigma',work.sigma, '-one', work.B1]);
  var worker = {ecm:ecm, work:work}
  ecm.stdin.end(r_ufos[work.ufo].toString());
  ecm.stdout.setEncoding('utf8');
  ecm.stdout.on('data',function(d){
    console.log('DEBUG: got data: "%s"', d);
    var m = d.match(/^[*]{10} Factor found[^:]*: ([0-9]+)/);
    if (!m) return;
    ecm.kill();
    var fac = bigint(m[1]);
    var u = r_ufos[work.ufo];
    assert(fac.gt(1));
    assert(fac.lt(u));
    var d = u.div(fac);
    if (!d.mul(fac).eq(u)) return;
    if (d.lt(fac)) {
      fac = d;
    }
    factor_found = fac;
  });
  ecm.stderr.setEncoding('utf8');
  ecm.stderr.on('data',function(d){
    console.log('ECM ERR: "%s"', d);
  });
  ecm.on('close', function(code, signal){
    var ret = (code !== null) ? code : signal;
    if (ret !== 'SIGTERM' && ret !== 0) {
      console.log('ecm exited with code/signal %s',ret);
    }
    ecm.removeAllListeners();
    ecm.stdin.removeAllListeners();
    ecm.stdout.removeAllListeners();
    ecm.stderr.removeAllListeners();
    return handleCompleted(work, factor_found, ret);
  });
  ecm.stdin.on('error', function(e){
    console.log('ECM CONN ERR: %s', e.message || e);
  });
  workers.push(worker);
}


// work - the work object received from the server
// factor_found - bigint|null
// return_code - the return code of the ecm command
function handleCompleted(work, factor_found, return_code) {
  var work_result = {};
  work_result.id = work.id;
  if (factor_found) {
    work_result.found = factor_found.toString();
  }
  work_result.ret = return_code;
  var num_to_get = do_exit ? 0 : 1;
  return getWork([work_result], num_to_get);
}


// decrypt a string from the server; returns undefined if failure
function fromServer(m) {
  if (!m || !m.charCodeAt) return;   // should be string
  var m_split = m.split('|');
  if (m_split.length !== 2) return;
  var nonce = new Buffer(m_split[0], 'base64');
  if (nonce.length !== sodium.crypto_box_NONCEBYTES) return;
  var cipherText = new Buffer(m_split[1], 'base64');
  if (!cipherText.length) return;
  var plainBuffer = sodium.crypto_box_open(cipherText, nonce, SERVER_KEY, secret);
  if (!plainBuffer) return;
  return JSON.parse(plainBuffer.toString('utf8'));
}


function toServer(o) {
  assert(o);
  var nonce = new Buffer(sodium.crypto_box_NONCEBYTES);
  sodium.randombytes_buf(nonce);
  var plainBuffer = new Buffer(JSON.stringify(o), 'utf8');
  var cipherMsg = sodium.crypto_box(plainBuffer, nonce, SERVER_KEY, secret);
  assert(cipherMsg);
  return format('%s|%s',
    nonce.toString('base64'),
    cipherMsg.toString('base64')
  );
}


function generateNewConfig() {
  var nick = 'anon' + Math.round(Math.random()*10000);
  var cores = os.cpus().length;
  var keypair = new sodium.crypto_box_keypair();
  var pubkey = keypair.publicKey;
  var secret = keypair.secretKey;
  return {
    nick: nick,
    cores: cores,
    pubkey: pubkey.toString('base64'),
    secret: secret.toString('base64')
  };
}


getWork([], cores);
