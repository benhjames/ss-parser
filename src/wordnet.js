// This is a shim for wordnet lookup.
// http://wordnet.princeton.edu/wordnet/man/wninput.5WN.html

import _ from 'lodash';
import async from 'async';
import natural from 'natural';

const wordnet = new natural.WordNet();

const define = function define(word, cb) {
  wordnet.lookup(word, (results) => {
    if (!_.isEmpty(results)) {
      cb(null, results[0].def);
    } else {
      cb('no results');
    }
  });
};

// Does a word lookup
// @word can be a word or a word/pos to filter out unwanted types
const lookup = function lookup(word, pointerSymbol = '~', cb) {
  let pos = null;

  const match = word.match(/~(\w)$/);
  if (match) {
    pos = match[1];
    word = word.replace(match[0], '');
  }

  const itor = (word1, next) => {
    wordnet.get(word1.synsetOffset, word1.pos, (sub) => {
      next(null, sub.lemma);
    });
  };

  const synets = [];

  wordnet.lookup(word, (results) => {
    results.forEach((result) => {
      result.ptrs.forEach((part) => {
        if (pos !== null && part.pos === pos && part.pointerSymbol === pointerSymbol) {
          synets.push(part);
        } else if (pos === null && part.pointerSymbol === pointerSymbol) {
          synets.push(part);
        }
      });
    });

    async.map(synets, itor,
      (err, items) => {
        items = _.uniq(items);
        items = items.map(x => x.replace(/_/g, ' '));
        cb(err, items);
      }
    );
  });
};


// Used to explore a word or concept
// Spits out lots of info on the word
const explore = function explore(word, cb) {
  let ptrs = [];

  wordnet.lookup(word, (results) => {
    for (let i = 0; i < results.length; i++) {
      ptrs.push(results[i].ptrs);
    }

    ptrs = _.uniq(_.flatten(ptrs));
    ptrs = _.map(ptrs, item =>
       ({ pos: item.pos, sym: item.pointerSymbol })
    );

    ptrs = _.chain(ptrs)
    .groupBy('pos')
    .map((value, key) =>
       ({
         pos: key,
         ptr: _.uniq(_.map(value, 'sym')),
       })
    )
    .value();

    const itor = (item, next) => {
      const itor2 = (ptr, next2) => {
        lookup(`${word}~${item.pos}`, ptr, (err, res) => {
          // console.log(err);
          // console.log(word, item.pos, ":", ptr, res.join(", "));
          // console.log(res);
          next2();
        });
      };
      async.map(item.ptr, itor2, next);
    };
    async.each(ptrs, itor, () => {
      cb();
    });
  });
};

export default {
  define,
  explore,
  lookup,
};
