'use strict';

var bops = require('bops');
var bigint = require('bigint');
var crypto = require('crypto');
var assert = require('assert');

var HASH_OUTPUT_BITS = 256;   // matches crypto.createHash('sha256')



// translated from Anoncoin CHashWriter in hash.h
function HashWriter(nTypeIn, nVersionIn) {
  this.nType = nTypeIn;         // unused
  this.nVersion = nVersionIn;   // unused
  this._ctx = crypto.createHash('sha256');
}


// need update* functions because JS is dynamically typed and doesn't have
// operator overloading
HashWriter.prototype.updateString = function(s) {
  var b = new Buffer(s, 'utf8');
  assert(b.length < 256, "string must be 255 bytes or less");
  var lenb = new Buffer([b.length]);
  this._ctx.update(lenb);
  this._ctx.update(b);
}


HashWriter.prototype.updateUInt32 = function(n) {
  var b = new Buffer(4);
  bops.writeUInt32LE(b, n, 0);
  this._ctx.update(b);
}


// returns a 256-bit bigint
HashWriter.prototype.getHash = function() {
  var hash1_buf = this._ctx.digest();
  var hash2_buf = crypto.createHash('sha256').update(hash1_buf).digest();
  var hash2 = bigint.fromBuffer(hash2_buf, {endian:'little', size:32});
  return hash2;
}



// translated from ParamGeneration.cpp commit fed7adbe51a8691a5506ddf076b5ba843fec22da
function calculateRawUFO(ufoIndex, numBits) {
  var result = bigint(0);
  var hashes = Math.floor(numBits / HASH_OUTPUT_BITS);

  if (numBits !== HASH_OUTPUT_BITS * hashes) {
    throw new Error('numBits must be divisible by HASH_OUTPUT_BITS'); // not impl.
  }

  for (var i = 0; i < hashes; i++) {
    var hasher = new HashWriter(0, 0);
    hasher.updateUInt32(ufoIndex);
    hasher.updateString('||');
    hasher.updateUInt32(numBits);
    hasher.updateString('||');
    hasher.updateUInt32(i);
    var hash = hasher.getHash();
    result = result.shiftLeft(HASH_OUTPUT_BITS);
    result = result.add(hash);
  }

  return result;
}


// returns a bigint containing the UFO candidate with the specified ufoIndex
exports.get = function get(ufoIndex) {
  return calculateRawUFO(ufoIndex, 3840);
};
