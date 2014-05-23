/** LICENCE
 *
 * SteamGifts Plus Addon
 * Copyright (c) 2012-2013 Kaitlyn <reowkaitlyn@gmail.com>
 * http://steamgifts-plus.googlecode.com
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 *
 * Credits to cg (http://www.steamgifts.com) and Steve Sobel (http://redditenhancementsuite.com/) whom I modifed code from.
 */

//External libraries moved inside to reduce load times from page fetches.
//lscache
var lscache = function() {
    var CACHE_PREFIX = 'lscache-';
    var CACHE_SUFFIX = '-cacheexpiration';
    var EXPIRY_RADIX = 10;
    var EXPIRY_UNITS = 60 * 1000;
    var MAX_DATE = Math.floor(8.64e15 / EXPIRY_UNITS);
    var cachedStorage;
    var cachedJSON;
    var cacheBucket = '';

    function supportsJSON() {
        if (cachedJSON === undefined) {
            cachedJSON = (window.JSON != null);
        }
        return cachedJSON;
    }

    function expirationKey(key) {
        return key + CACHE_SUFFIX;
    }

    function currentTime() {
        return Math.floor((new Date().getTime()) / EXPIRY_UNITS);
    }

    function getItem(key) {
        return localStorage.getItem(CACHE_PREFIX + cacheBucket + key);
    }

    function setItem(key, value) {
        localStorage.setItem(CACHE_PREFIX + cacheBucket + key, value);
    }

    function removeItem(key) {
        localStorage.removeItem(CACHE_PREFIX + cacheBucket + key);
    }
    return {
        set: function(key, value, time) {
            if (typeof value !== 'string') {
                if (!supportsJSON()) return;
                try {
                    value = JSON.stringify(value);
                } catch (e) {
                    return;
                }
            }
            try {
                setItem(key, value);
            } catch (e) {
                if (e.name === 'QUOTA_EXCEEDED_ERR' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                    var storedKeys = [];
                    var storedKey;
                    for (var i = 0; i < localStorage.length; i++) {
                        storedKey = localStorage.key(i);
                        if (storedKey.indexOf(CACHE_PREFIX + cacheBucket) === 0 && storedKey.indexOf(CACHE_SUFFIX) < 0) {
                            var mainKey = storedKey.substr((CACHE_PREFIX + cacheBucket).length);
                            var exprKey = expirationKey(mainKey);
                            var expiration = getItem(exprKey);
                            if (expiration) {
                                expiration = parseInt(expiration, EXPIRY_RADIX);
                            } else {
                                expiration = MAX_DATE;
                            }
                            storedKeys.push({
                                key: mainKey,
                                size: (getItem(mainKey) || '').length,
                                expiration: expiration
                            });
                        }
                    }
                    storedKeys.sort(function(a, b) {
                        return (b.expiration - a.expiration);
                    });
                    var targetSize = (value || '').length;
                    while (storedKeys.length && targetSize > 0) {
                        storedKey = storedKeys.pop();
                        removeItem(storedKey.key);
                        removeItem(expirationKey(storedKey.key));
                        targetSize -= storedKey.size;
                    }
                    try {
                        setItem(key, value);
                    } catch (e) {
                        return;
                    }
                } else {
                    return;
                }
            }
            if (time) {
                setItem(expirationKey(key), (currentTime() + time).toString(EXPIRY_RADIX));
            } else {
                removeItem(expirationKey(key));
            }
        },
        get: function(key) {
            var exprKey = expirationKey(key);
            var expr = getItem(exprKey);
            if (expr) {
                var expirationTime = parseInt(expr, EXPIRY_RADIX);
                if (currentTime() >= expirationTime) {
                    removeItem(key);
                    removeItem(exprKey);
                    return null;
                }
            }
            var value = getItem(key);
            if (!value || !supportsJSON()) {
                return value;
            }
            try {
                return JSON.parse(value);
            } catch (e) {
                return value;
            }
        },
        remove: function(key) {
            removeItem(key);
            removeItem(expirationKey(key));
        },
        flush: function() {
            for (var i = localStorage.length - 1; i >= 0; --i) {
                var key = localStorage.key(i);
                if (key.indexOf(CACHE_PREFIX + cacheBucket) === 0) {
                    localStorage.removeItem(key);
                }
            }
        },
        setBucket: function(bucket) {
            cacheBucket = bucket;
        },
        resetBucket: function() {
            cacheBucket = '';
        }
    };
}();

function mergeSort(left, right) {
    var result = [],
        il = 0,
        ir = 0;

    while (il < left.length && ir < right.length) {
        if (left[il] < right[ir]) {
            result.push(left[il++]);
        } else {
            result.push(right[ir++]);
        }
    }

    return result.concat(left.slice(il)).concat(right.slice(ir));
}

function binarySearch(value, items) {
    var startIndex = 0,
        stopIndex = items.length - 1,
        middle = ((stopIndex + startIndex) >> 1);

    while (items[middle] != value && startIndex < stopIndex) {
        //adjust search area
        if (value < items[middle]) {
            stopIndex = middle - 1;
        } else if (value > items[middle]) {
            startIndex = middle + 1;
        }

        //recalculate middle
        middle = ((stopIndex + startIndex) >> 1);
    }

    //make sure it's the right value
    return (items[middle] != value) ? -1 : middle;
}

//Addon
(function($) {
    var unsafeWindow = this['unsafeWindow'] || window;
    $.fn.reverse = [].reverse;

    var addon = {
        'version': '0.9.87-BETA'
    };

    //I can has bucket?
    lscache.setBucket('sgp');

    var user = {
        'loggedIn': false,
        'username': '',
        'points': 0,
    };

    var image = {
        'icon16': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAmpJREFUeNp8k81OFEEUhc+tmuZPdGBAWCgkECSiRF1I4oINCYkrn8CFibpxZ+LGx3ClK5/AhDXGRB5BEl25YMAhJijM6GCgu7rqXm/VwDizsWcq3dV969Tp754mvJShtfrzxUnTfJNZs2ysuYT/HMLSdj58OeTas625V19p6uba3fmxsDVz9cqosRVYa0FkQLGazlelP0QYPgRI8LHm5FcYfWAvDtLbVqt1A8agNj4Oa6wuJKgTXa8/vSZDSSDNRRB0OFdmFcmXDHNYFS3aa+xjp15PG8YiCYyfq6/RXH6BoNfMnISDKjGrCKsT9ncqwjwK3QFisPttPwksLlxL51IylNXrGHZODRp9BUGWZSjyAsGraPADFZYoCRg9k6Uk4vXW/OxsF5xTgfMjMnKuQFkW8D6gEq1FaEwhCcWjsddAWZSYWu/MT3VH6umEL50u9ih1UHViWhJ1hdd63Ohr2fw4Y65m+tt4coB84yG8K5WFhwkJSCQbQO3dvuKdlkG9yX33aGQa+WmOwuXIo7ML1QmJLaQek5RaCRw//Z7mM++WMFYd6z5XeJoHrw4SA4WnuwvZ3rgpF+lOj45aCs1jZHDoXwlCaq92Qa1LfM9eq/22y8Kh3T4GNOTWdJwGBRhlDAf5EzSeEUiMae+gY4XK5ZlIjsMfB4mXy/PU2tK5E6oMVz8Ih/UYJpIYW9PNfudjkDM+jJhYBYBsYCA5IVv5SOby8j38rr/XJ2rQpLim1aaTe+niVQHdAJGNMrJk21RbuG/4yedtTN1eUYibGtWmxIxrgaTX4rQjp6FiETZrDeymn7y14h592v4rwAAJ42bBRk+RFwAAAABJRU5ErkJggg==',
        'loadinggif': 'data:image/gif;base64,R0lGODlhIAAgAPMAAP///wAAAMbGxoSEhLa2tpqamjY2NlZWVtjY2OTk5Ly8vB4eHgQEBAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/hpDcmVhdGVkIHdpdGggYWpheGxvYWQuaW5mbwAh+QQJCgAAACwAAAAAIAAgAAAE5xDISWlhperN52JLhSSdRgwVo1ICQZRUsiwHpTJT4iowNS8vyW2icCF6k8HMMBkCEDskxTBDAZwuAkkqIfxIQyhBQBFvAQSDITM5VDW6XNE4KagNh6Bgwe60smQUB3d4Rz1ZBApnFASDd0hihh12BkE9kjAJVlycXIg7CQIFA6SlnJ87paqbSKiKoqusnbMdmDC2tXQlkUhziYtyWTxIfy6BE8WJt5YJvpJivxNaGmLHT0VnOgSYf0dZXS7APdpB309RnHOG5gDqXGLDaC457D1zZ/V/nmOM82XiHRLYKhKP1oZmADdEAAAh+QQJCgAAACwAAAAAIAAgAAAE6hDISWlZpOrNp1lGNRSdRpDUolIGw5RUYhhHukqFu8DsrEyqnWThGvAmhVlteBvojpTDDBUEIFwMFBRAmBkSgOrBFZogCASwBDEY/CZSg7GSE0gSCjQBMVG023xWBhklAnoEdhQEfyNqMIcKjhRsjEdnezB+A4k8gTwJhFuiW4dokXiloUepBAp5qaKpp6+Ho7aWW54wl7obvEe0kRuoplCGepwSx2jJvqHEmGt6whJpGpfJCHmOoNHKaHx61WiSR92E4lbFoq+B6QDtuetcaBPnW6+O7wDHpIiK9SaVK5GgV543tzjgGcghAgAh+QQJCgAAACwAAAAAIAAgAAAE7hDISSkxpOrN5zFHNWRdhSiVoVLHspRUMoyUakyEe8PTPCATW9A14E0UvuAKMNAZKYUZCiBMuBakSQKG8G2FzUWox2AUtAQFcBKlVQoLgQReZhQlCIJesQXI5B0CBnUMOxMCenoCfTCEWBsJColTMANldx15BGs8B5wlCZ9Po6OJkwmRpnqkqnuSrayqfKmqpLajoiW5HJq7FL1Gr2mMMcKUMIiJgIemy7xZtJsTmsM4xHiKv5KMCXqfyUCJEonXPN2rAOIAmsfB3uPoAK++G+w48edZPK+M6hLJpQg484enXIdQFSS1u6UhksENEQAAIfkECQoAAAAsAAAAACAAIAAABOcQyEmpGKLqzWcZRVUQnZYg1aBSh2GUVEIQ2aQOE+G+cD4ntpWkZQj1JIiZIogDFFyHI0UxQwFugMSOFIPJftfVAEoZLBbcLEFhlQiqGp1Vd140AUklUN3eCA51C1EWMzMCezCBBmkxVIVHBWd3HHl9JQOIJSdSnJ0TDKChCwUJjoWMPaGqDKannasMo6WnM562R5YluZRwur0wpgqZE7NKUm+FNRPIhjBJxKZteWuIBMN4zRMIVIhffcgojwCF117i4nlLnY5ztRLsnOk+aV+oJY7V7m76PdkS4trKcdg0Zc0tTcKkRAAAIfkECQoAAAAsAAAAACAAIAAABO4QyEkpKqjqzScpRaVkXZWQEximw1BSCUEIlDohrft6cpKCk5xid5MNJTaAIkekKGQkWyKHkvhKsR7ARmitkAYDYRIbUQRQjWBwJRzChi9CRlBcY1UN4g0/VNB0AlcvcAYHRyZPdEQFYV8ccwR5HWxEJ02YmRMLnJ1xCYp0Y5idpQuhopmmC2KgojKasUQDk5BNAwwMOh2RtRq5uQuPZKGIJQIGwAwGf6I0JXMpC8C7kXWDBINFMxS4DKMAWVWAGYsAdNqW5uaRxkSKJOZKaU3tPOBZ4DuK2LATgJhkPJMgTwKCdFjyPHEnKxFCDhEAACH5BAkKAAAALAAAAAAgACAAAATzEMhJaVKp6s2nIkolIJ2WkBShpkVRWqqQrhLSEu9MZJKK9y1ZrqYK9WiClmvoUaF8gIQSNeF1Er4MNFn4SRSDARWroAIETg1iVwuHjYB1kYc1mwruwXKC9gmsJXliGxc+XiUCby9ydh1sOSdMkpMTBpaXBzsfhoc5l58Gm5yToAaZhaOUqjkDgCWNHAULCwOLaTmzswadEqggQwgHuQsHIoZCHQMMQgQGubVEcxOPFAcMDAYUA85eWARmfSRQCdcMe0zeP1AAygwLlJtPNAAL19DARdPzBOWSm1brJBi45soRAWQAAkrQIykShQ9wVhHCwCQCACH5BAkKAAAALAAAAAAgACAAAATrEMhJaVKp6s2nIkqFZF2VIBWhUsJaTokqUCoBq+E71SRQeyqUToLA7VxF0JDyIQh/MVVPMt1ECZlfcjZJ9mIKoaTl1MRIl5o4CUKXOwmyrCInCKqcWtvadL2SYhyASyNDJ0uIiRMDjI0Fd30/iI2UA5GSS5UDj2l6NoqgOgN4gksEBgYFf0FDqKgHnyZ9OX8HrgYHdHpcHQULXAS2qKpENRg7eAMLC7kTBaixUYFkKAzWAAnLC7FLVxLWDBLKCwaKTULgEwbLA4hJtOkSBNqITT3xEgfLpBtzE/jiuL04RGEBgwWhShRgQExHBAAh+QQJCgAAACwAAAAAIAAgAAAE7xDISWlSqerNpyJKhWRdlSAVoVLCWk6JKlAqAavhO9UkUHsqlE6CwO1cRdCQ8iEIfzFVTzLdRAmZX3I2SfZiCqGk5dTESJeaOAlClzsJsqwiJwiqnFrb2nS9kmIcgEsjQydLiIlHehhpejaIjzh9eomSjZR+ipslWIRLAgMDOR2DOqKogTB9pCUJBagDBXR6XB0EBkIIsaRsGGMMAxoDBgYHTKJiUYEGDAzHC9EACcUGkIgFzgwZ0QsSBcXHiQvOwgDdEwfFs0sDzt4S6BK4xYjkDOzn0unFeBzOBijIm1Dgmg5YFQwsCMjp1oJ8LyIAACH5BAkKAAAALAAAAAAgACAAAATwEMhJaVKp6s2nIkqFZF2VIBWhUsJaTokqUCoBq+E71SRQeyqUToLA7VxF0JDyIQh/MVVPMt1ECZlfcjZJ9mIKoaTl1MRIl5o4CUKXOwmyrCInCKqcWtvadL2SYhyASyNDJ0uIiUd6GGl6NoiPOH16iZKNlH6KmyWFOggHhEEvAwwMA0N9GBsEC6amhnVcEwavDAazGwIDaH1ipaYLBUTCGgQDA8NdHz0FpqgTBwsLqAbWAAnIA4FWKdMLGdYGEgraigbT0OITBcg5QwPT4xLrROZL6AuQAPUS7bxLpoWidY0JtxLHKhwwMJBTHgPKdEQAACH5BAkKAAAALAAAAAAgACAAAATrEMhJaVKp6s2nIkqFZF2VIBWhUsJaTokqUCoBq+E71SRQeyqUToLA7VxF0JDyIQh/MVVPMt1ECZlfcjZJ9mIKoaTl1MRIl5o4CUKXOwmyrCInCKqcWtvadL2SYhyASyNDJ0uIiUd6GAULDJCRiXo1CpGXDJOUjY+Yip9DhToJA4RBLwMLCwVDfRgbBAaqqoZ1XBMHswsHtxtFaH1iqaoGNgAIxRpbFAgfPQSqpbgGBqUD1wBXeCYp1AYZ19JJOYgH1KwA4UBvQwXUBxPqVD9L3sbp2BNk2xvvFPJd+MFCN6HAAIKgNggY0KtEBAAh+QQJCgAAACwAAAAAIAAgAAAE6BDISWlSqerNpyJKhWRdlSAVoVLCWk6JKlAqAavhO9UkUHsqlE6CwO1cRdCQ8iEIfzFVTzLdRAmZX3I2SfYIDMaAFdTESJeaEDAIMxYFqrOUaNW4E4ObYcCXaiBVEgULe0NJaxxtYksjh2NLkZISgDgJhHthkpU4mW6blRiYmZOlh4JWkDqILwUGBnE6TYEbCgevr0N1gH4At7gHiRpFaLNrrq8HNgAJA70AWxQIH1+vsYMDAzZQPC9VCNkDWUhGkuE5PxJNwiUK4UfLzOlD4WvzAHaoG9nxPi5d+jYUqfAhhykOFwJWiAAAIfkECQoAAAAsAAAAACAAIAAABPAQyElpUqnqzaciSoVkXVUMFaFSwlpOCcMYlErAavhOMnNLNo8KsZsMZItJEIDIFSkLGQoQTNhIsFehRww2CQLKF0tYGKYSg+ygsZIuNqJksKgbfgIGepNo2cIUB3V1B3IvNiBYNQaDSTtfhhx0CwVPI0UJe0+bm4g5VgcGoqOcnjmjqDSdnhgEoamcsZuXO1aWQy8KAwOAuTYYGwi7w5h+Kr0SJ8MFihpNbx+4Erq7BYBuzsdiH1jCAzoSfl0rVirNbRXlBBlLX+BP0XJLAPGzTkAuAOqb0WT5AH7OcdCm5B8TgRwSRKIHQtaLCwg1RAAAOwAAAAAAAAAAAA==',
        'usertag': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAPCAYAAAD+pA/bAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAalJREFUeNrUVDuLwkAQnj2vE9+PqKiFaS2srA78C/c3rLSwz6azuOL8C/6CA+1MI0SxEgRBLAIqNtqk8BHE1+0IK656EQuLG/jYJdmZb3bmmyXH4xFeaW/wYnu3+zkYDJR4PE6fDdrtdmkikVBTqRSQeyVqNpuKy+WioVAIttvt01n7/X7o9Xo0l8upNwSNRkPx+Xw3wfv9/hdbfh7E/kyn0yXceL1eCAaDRChRrVZTJEmikUgEVqvVtbMhy7JuF90wjPx+vz/tD4eD2OR6va4EAgEai8VgOBwW2Uqm02lxt9sBAg2dF4vFXYzH49OZy/MCgdPppMlkEtbrNWSz2Qp+Yw2ubDYbQKBhOTGzv8CTQPDSnwlM06TsirBcLqHT6RQ0TYPJZFK4LAEG4QGuwQn4DSzLEmWayWTUdrsN0WiUejyebwR34DYajWw77HA4zucxUYEANctMbbVa4Ha7aTgcvvaXWYCPRyriTZ7NZsAUJQ4aJ9F1Ha9MMSPUNBqTHMqv9GgGkGA+n+N6GlBi9xZVq1WFEPL0JLPyUlZutVwu2xP8i8fuV4ABAF3n/2Hp1B3FAAAAAElFTkSuQmCC',
        'userIgnoredAvatar': 'data:image/png;base64,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',
        'dropdownArrowDark': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABsAAAAPCAYAAAAVk7TYAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAMdJREFUeNqslMENwjAMRd2o1wiUybj10Ck6SafgwI3JqlYMkDpgSwYciJtYsuRYzn/KT5suxgiXYTwDwAnKY8Nc77crWKIXoAXzUbDHYwaqVwvMGUFAc4vRidfJhMAz/lmDTvB8sMKcXJTcgfWeVJhF5CiwV2yaqZxYVOs1gSVBzCQ+I4Rr7leFy/RZuBlIhQmbpk9QjYXZkynAatAvG9/EW4AkzNPP+gXUQDjrj8I2eg1UYAYUaJ/50+fHNAmEEiC/+lbYLsAA84BF9SzViBkAAAAASUVORK5CYII=',
        'lookup': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAANCAAAAAC4QtCeAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAAJ0Uk5TAP9bkSK1AAAAaklEQVQI12P4///u3NrauXf/AwHD//05YLAfxLmbl7/n48c9+Xn3gZxJYDGg/BQgpyznC4jzJacMmVOMrgxowMFPnw5CDIAZnbMLxAFaWl09txrEY/gPAe87gTwY5//PmTmr4Jz/f699BgAmIHmp1XxJagAAAABJRU5ErkJggg==',
        'prevComment': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAALVJREFUeNpiNKndyiDyZF/hGxmnPgYiAVB90fZ5Pf0sMI3CTw+m7pjbOQeXBtO6bWAaqC4FqH62Z1IJAwtM41tp+znE2ApSB1TPADKAEejs/0AxxtNNXgQ1wmyHgv8MIM1AwIAL45IHiTMRsOk/PnkmQhqB3mEkSTMxGnFqhmki29nEGIA3wMhyNrEGgDV7JJenEJO6QIkEhGHqmUCJHJjkZhMyADltg9SD9DGSm6uA6vsBAgwAY5OIAn6S05EAAAAASUVORK5CYII=',
        'prevCommentHover': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAQpJREFUeNpi/P//PwMIRMy+ag+kioDYGIilGTDBUyA+C8R9K1K1D4IEGEGaw2ZdqQCy2xmIB5Wr0nQ6GINmXAbZuBeImUnQ/BeIHVj+/vvfQqJGBqj6FiagZl0gZsCFN2Tq4pIzYPnz9z8/LuO35+mDaaAabNL8LH/+YZVg2F1gAKZdJ1zA6XYWbKbuLzYE04695/F6nOk30GZ0bNN9Dm4INnkYZgLZjA1bdJwFG3Ck1IgBlxomoJ8/gvyNDZu0nYEEGHb5L6AAuwyUt8HlL4OW07ikzoISSQ2ZKayG6XKd2UGQAfgSChZcA9R3hBGWq9TrTsBylRkQS2Cx7QUQnwLlqptNFuBcBRBgAH0nElAFRYc2AAAAAElFTkSuQmCC',
        'nextComment': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAALVJREFUeNpi/P//P4NnUknhGxmnPgYigciTfUVA9f0sMI3CTw+mvpW2nwOSPN3khVOjR3J5ClD9bKABDCzoGgkBkDqgegaQAYwmtVv/A8UYYZL4bIUB07ptIOo/A0gzyN/oGJc4sjwTARv+45PHqRnofEZCBuC1mZABRDkbZgjRmglpJNrZZAcYQc2gJAeKeGjkEwQg9WDNoEQOTHKzgUkuBSn14NUIUg/SB0qeoFxCVq4CCDAAFtCHax8k1HwAAAAASUVORK5CYII=',
        'nextCommentHover': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAARBJREFUeNpi/P//PwMIRMy+ag+kioDYGIilGTDBUyA+C8R9K1K1D4IEGEGaw2ZdqQCy2xmIB5Wr0nQ6GINmXLYBcg4AMTMJmv8CsTPL33//W0jUyABV38IE1GwAxAzoeEOmLgM2cSSsy/Tn739+IGZAxyCwOVuPAZscFPMz/QGagg27TrgANmB7nj4DLjVMeExmcOw9DzZgd4EBVnmW3//+4wyVI6VGYNqm+xxWeRaY/9DBiQpjMG3RcRan4SxAt38B0jzYJE3azuCLro8gzSCj7dFlDFpOE4rry6BEUkNmCqthulxndgRkAIEEgY5rgPoOMsJylXrdCViuMgNiCSy2vQDiU6BcdbPJApyrAAIMAHomD2V70KtxAAAAAElFTkSuQmCC',
        'imageHover': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAICAYAAAAvOAWIAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAASVJREFUeNpcjztOw0AQhr/dbJw4JHEQKEKAROihQghxAirIIbgCBTeABm5BRUtPAQUgIqoIIUSBFB4psBxkEsuOdxlTMtpiHv9+/4xyzlE/6LlxBkox3lxgB7i+Odzgf6ito3v3ncBTBJWyYnFG4ayjVnYYLQqr5Dl8A6b4EU81Vc+n1fDY3w6wdopyltPLT0zJkGQpnSZogTCclAhaDU66be4GMRf9EVfPIcd7S6wv16l5Hkku4kR2LfZuelKIS/ST8xhqvhIjVOlojZNjlMx0LuSC7sQql6RZ0bT9nPl6MVakIsikr6U0pgRzVUskFucPId21BrvW/yOc3X7wMsyJJykrNY0pruwElvdxQu81o/82IopToTpmqxotrquBpizQXwEGAE5xdI/jOVpuAAAAAElFTkSuQmCC',
        'nofityBGBlue': 'data:image/png;base64,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',
        'ignore': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAALCAIAAAAmzuBxAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAXNJREFUeNokkMlKA0EQhrt6ZkzIchAi2UAEk5ML7ggaD1HQg55U0AdI9AGCTyCexJMIonF5Abd4UNB4MYgbRi+GeBEMDgSChpA4me6etsRDHYqq+orvByklwdJ1cZGWuZwsl6GpiXZ30ZEINDYSQgCn1v0D29snnBOHA2w2WTdI7Qe8Xm0hBsEgWO/v5vIKoZR2dijRKA21irNznjpFMPi8WiKhsqNjxCi9PVo8hkxZKIj8mxSCIOxTFzc3qnh+AZdLnZrEsfWaM7eTslRShodoSws/OBS3d1QyRux28PvxXX07aRWLEApp83NKf5+k1CqXqUWIqFZZ+srY3BK6DuGwbTEOTid/eBSVCkG80t7Gn7LGzi5hTBsbtc1MoyQ6s8u0NAwk0YbZGck5NqiK20RV2XWmtrrG83nw+bRI5C8Plsn8rG9I0wS3G1RV1mp4QAMBx1JCaW6G/0zFR8E8SfFs1vr6pn6/NjjQMDFOPR4U/BVgADK5uZhGo1KXAAAAAElFTkSuQmCC',
        award: {
            '1Year': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAuCAYAAABXuSs3AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABIBJREFUeNrsmc9vG0UUx78zs+v1OlnHriPSNoUAKlJDxa1qGnFA4sCfAJxAlXKjAoE4UFTBCYkT4oAQiB9VEb9SpEqAkIK4ICREhJQTYDgFRCQgLpRg1/b+Ht6sXbOxnWAnXteRPM6Lx7ur3c+8+b43MzvsntP3CQCS7ATZ02QPSInDvucI13ERBB5kGEJKdUnyhTEGxjmE0JEyUtB0g45Fp/4me5bsDbJQU9eS3Uv2AtmC77m6Y9tw7TrC0EcoVavCRtOGQk5/koPzOlxXQyplwkib1AA9T2efI/uD7BMFfj/ZS+TQedeu8Xr9OnzPI1SCDdvvyZIHl41/oXq8T70dhPA8G6Y5CcPMHKGTLyp4BX6ebN4h6Nr1CnySBmKyaMEyDL8QRiADBF4IIyMgGafeCO+iMy8r8EWSB3fqNdKz3wnNuviaDQ/8xrddLcM6NA2n8g8Xgp/SpAwNpWnPc4g57PByHL5HiQ5U7zeKkk3lrxIm8tMIahWh+a7XDMR2QTfxmyEdr+/+rAS6g1SgnF8rb8G0cpBCgJNMSEd+hzy2QavvHaBZ2yehHNlgoEIJBJxSpeapyA3bodl26H48y5LN8T7JOpPNQVN5hzW7IibsHaG7Au8Am81mcfLuE1H9m9VvBwLvufVogNJCqYYX2cbc3Z8dR9nuLVg6+wieeuJcVD925/xAwIMgIIcS+M5QrA9o1lFbPHO6Bb26ujpwBWm9ZSW2K3A7lJLHm6+9EtWr1ergtB+bdvC9Bxfr2g7l6cvvv0P6tqJDm5ubsev3abHsxvfmbdb5k2745OPnCPpSC1qVcrmcSIbh6M/BXaEXFxaw8ukV0vRjLU1/uHw5CiTOeSLg2l5GwTj00tlH8fyFZ6KfxWIx8vBnK1/gu++LePihB1EoFFCr1QYWnLKf4IyTbnc8g2VZNM/xsLa2hqtX/8Srr7+NH378KdK6KrlcDhsbGz1NF3pCaU4CtX3colVbWfkcH135GF9+9fW2AEpq+N8VvFMm3VPiex8so0Se7nUSlmhwsv/nbZWbAd1fVhnWTCpZ8LYmMHYAwG++swfj8TH4GHwMPgYfg4/BRxLcdd2DCb6+vj78pdt+SrlcwVsXLyW3npg7flK6jt1Yy7HmHoz6MN592ca6vAAa5gKCCxRuvQNqswWSsQMTlFo6HW2mcU3TwQ5QbtFTafiuA66nUhBC61z/jyp4OhPtTnD1klxtyQkhRt7b6cksuOIMFDhnMmWkISLJxLQuR8v1ShWT+Wl41TJxikCp+2dN10ODuiBfOArNMEdOMZqeQmF2Dm69qjyt0Iriltm5ElVOCV3Ppc0JNjN7e7Rt6NjViP6/XYn4W6zhpUOLvHzktuNwiSdwbUqA7Fc6fF6Bq6HNo0efCXzPrFNX5GeOIpubpgg2ILjW2M8n6XQDHzS8koRpZWFNFXDo8DFkrClslX5D4LsK+he65AKaW+I22UWyGbIlssJW6Xeuke7NCQtT0zNRQKjEP4wShgHCICBZ1GBXKwgc2yfPXKNTytPvki2TBf8KMABPuYUhpOGHRwAAAABJRU5ErkJggg==',
            '2Year': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAuCAYAAABXuSs3AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAACWNJREFUeNq8WWuIXVcV/vY+574m855pJjGPRqxmopQ2NG0TUxGHmgR/FEEwjai/hIIS+idVbLUWRAwK0h/aP0FFfFFBUFtKqVKlpUighdjasYIkaRRTb5tkMnfmPs5jb9fae5/XvTcz907SHmbPOfeefc/51tprfeuxxa13fdwDoGnM0zhB45DW2BKFHS/oBIjjEFopaM1T3v1DCAEhJTyvhHKlDL9Uoe/MrSs0HqZxiobyeS6NgzS+Q+PuKAxKnXYbQbsFpSIozVIpK9p7gpz+tISULQSBj3K5hkq1RgKUpujuozTeovEHBr5A4wek0D1BuylbrRVEYUhQCazqfqZ494Fr+0/x6yNa7VghDNuo1UZRqY1spZsnGTwD/zqNPR0C3VxpICLTQM4sUrBireUdApceTohYx4hDhcqIBy0krYb6IN15nIEfIPOQnVaT7DnqBS16dU2/z69sAbwQug9YkYLWYgghdHZury5jbHoWncZV6Xlyn6+1qrBNh2GHHqR6tJwHXwDorhlocps/S/6FKALTCWidCZIX4poC5IRks2lcqmPT1CziZsPzoyB0jqh61l/kkBqgUhQA8yHpO8mAWQBzLq5OApqdXClhnd0B5c/aPW9N7dNNvt1cXkJtbBLa8+CTmZAdRT3mUQAtrBYLWjYgAU/aYQXQ5p7Ma0onwAk0fYhVJoCU2mifr9cE75TBlEwEgjKzTMieq7pBix7Q6ALt0T+PXmxBa/iePRMFu3mZeWijXZDj0/cqEUAYIXiCdOAH4fiIzHpkfBI+P1G4pcgZdjqxxwnhTMOB9jwC7SMVgs/svCJvKgSQQbJQES1uZJ5rjMSCp2uh7XvXc9gwaJkA5SvN4UV3Ye7P2DJxwGQQaDI3A7bkM3BhNc/zZOaZVruk2dj5SFxknFhbJQ1ClXEc01wCfs3g0kXO0mkpMRcprQaNxgns1imJz907gYW9VcyMBvwK+mvhpdfaePHvMf70mjTaFsnqsYa1tVvDMtApbQ5y+OvblaW4wmdpuZyFYe1+6q4qHvpsCSOiTnZwFWg0aQLbTw0H58s0gMO3RfjqL8dT5IxRWVUY+2aTEck9vQ6v9wUuriWATp0uzzD3fLiEb93fAoJzwMTdxR+xECuL7JrYu0vhe8faeOhXc45ZaHhw7GJZZ11zEcNoPD9b5C9s4HngSBso34QX/jmLZ05fxKvn2iiR+cyOezi2MIZ7PzIDdC7S9Bh75zfjiws+fvLHOGWfxF/EkGmQHCZrSy4SrRycF7h5poHHftbCwz9+B6ff6JDzkKLJGS81Yjzx1BWceiZ2Xk/qrWzBwp2bMx/pWUF9Y4B3O2zKyy4KfvQDS/j5Szvx9Om2Yw5hQDN4Hpqun321jL/+a5reVDPP2L65bLUM7c6Zww4yBjaVRNtai1xQsSzw7d9NEaOsGFYhcjZTPWH4xMYA0qBHP372bzUcIF9AuERvnEDeWYTs4zhrQXHL7Q+YXWYBxeUdUNLwdxRnocYjhwuVAxFrN1/jzDm2i5Ixl1ZHueJkA2lujqb99cxEp3mESNlFIwFv85PIzQ5NeqC7RE1qA5KqPI1XXm8ZE4qThKtP+rthHhd9Phgo2nGJCRouhrjAFDGxxzq30lkC9aFtzHurZEcj+MuZuqFDnVCiyvKZYQ5/mMk6TT5k+g0HEaFccsYBKXaryTWJZ6cv3EavCep448IteO6VtjGvyCRbwmaNeniTGYgO8w/VBXaxYVsZirQ0GatkWHZhkLfuoAA1/Ql8/9eXETLoWKTzUmcfEvzAPJ4+WKy/rNrZL2vz0O0e5mfP48nnl7F4ISJhRC4nF9ZcNtBBkBtw6EJunmSN0l0Llxkmc79y+G28XN+Px3971QljNZzYttICG2nZ+MP+QPQUFC4X95Jzlpc/ejRGU74fx3/4TsoaeWe8nh6TP4ymBWwBYWtNC843qS3SCsj3bDg/epBse2cbDz6xbOaxzdtQL3AjmmL+sJrOg2bNMlCPnuK7a753YDfwhXsu4oFTW3FlRdkaVFr+VDb8GeYX19FfksPYd2oeuTKNTaPEGvettjnxevDwf/DIb7ZhaTVOS7y0epK6oITkmcM2lvxhHDJzxKxA9l0VxKns/t0Cxz/5b3z3qZ04/7/A3E+qe5tV2qBkMkOVS0+6490Atacc3Ex0pjGBXHXPdu5AH6rj5NPb8ebboTWhxGFN9Z90BIATn9b4/Mc6honyXYEbltb2NRfnoDIFTza9p4zj9wmc/P0k3qxHRhC7GjonAHDTpMAjR8u47/ZzeH6xumbb7oazSj7pZ00e2VfDifsnUBOX8aMvh/TEcVs09Fs3RdVS8yxefutO1K9e6unZDMM2/tAaz40jd5TxzWMENnidYnuDsr85YPUfBDDo/4DSLDB5AC8+d3lj3dvrCUDJyw7uVnjsM2fJVoj7xvbm7u5e87dNysf/fKaVBqKNCuAPC1gpmwW+sOjhjq/tQNlbJSpcNXSYRFEp80WHjZamrHP1aBSJQgPUND/TymowIXzTG4HAOs1SYxqmOcl0lvRBONNDlnjFBrgt2bIfizRbtP1DTmlRaH4Oo2wpPdMO91k9egDPyLpNcP0+4XrjwhQUDMyUcqLYc1Q6a8OZxk9cFCTR9qDm4lerZjPN9/0SAtnitsdANWdSsrEYkYsUnI9LV39KiZ7+uFLJOTOb9KxRMJP1jlK5iijowC+Vy/A6vt37QU+5WMzHU6AWvKk+ufrXGWDR1dwptppF3ya/1oNrvVQdgQoJuOT9xHLN7G7FKr6mfadO4wra2Alia1ECr5A29K8FPAGo+m2rDKDt6ug4JEUz1abITGmmLleqgncmVJTbIkwQd4GHznosnIOkdega2V63FgubWQPuyHmUgo5O8ebVEjtozHR4zi+VdlWqI3K0MoPG8hXEQbvHYtKH5jecdLInNFhapze4fUj2jOmtO9BurhBoUxAsepu33Vyni31eqTRZrW0Sc9t2mW3DTnvVvCkD5Toturelm5jMemMjxxhpeevOWxAQHlIoEaC4wHuzDPys6eUA++MorLVWlzE19z6MT86SB1eI4ny7n691ru8pevsw4sbsOrNJ1MbGMTYxg+kt2zEyNoGl+n8RRwGDPk9TvpFsiVPmg5/SoEQDX6Ixs1S/KP1KFbVNY5iYnTMOwcT/XhyKCELFMYJWE+3VBuJOm1mXkxvW9C9oPMnc8H8BBgAOf9dp2kSdcgAAAABJRU5ErkJggg==',
            '25Wins': 'data:image/png;base64,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',
            '500Value': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAuCAYAAABXuSs3AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAADHJJREFUeNrMWVmMHNUVPbX0vk3P6hnbjBdsZyYsMosXNhsLgWNQFmGSH6SQiA9+ovzkI0ERQlEi5YskShQpClIEQoJYCiDyQeRIAQTCxFIIS7CIFzxexp7F03t37VU593WPGa/ThrGVst/0Uq+rzrv33HPvfaXduGmbASDi+ArHjzjujyIs8z3HcB0XQeAhCkNEkUy5+oemadB0HYYRQzwRhxlL8Dt1qszxJMcfOUJT5nLcyfELjs2+58Yc24ZrWwhDH2EkqwrbS7smyPk/0qHrFlzXRDyeQiKZ4gJiRZ59imOK4zUBvoPjGRp0zLVbumU14HseoRJseP41tasPPGr/CeX2Pr0dhPA8G6lUFolUepgnfyngBfhPOMYcgm416vBJDSygxVmwGq79QRhBFCDwQiTSBiJNpzfCdTzzawG+lfTQHatFPvsXgtYuYmvt2gGff7WbNeR6++HUq7ph6LeZURQmhNOe5xBzeIGVF4LvkqJLyvf5Q2hTn5tBptiPoFU3TN/1OoF4PqE78DshvfD95e91FdxBFojxW7UKUrkeRIYBkzQhj/wL6HEO6IsANvjjgb4etFo26o3WFcndQF8R+WwSLcfD6akzi0ttx4gyjwKCuKiMJ5Ebng9auyxoOe66YzMe/c7DSi4/OXAAL+15BbNz5UtyRdc1rBpdgft3bEdPIYfTp6fQ19eHZ597EbV6o+tF+6R1Ot8DU3RH67hiAbEvCVoWFY+Z2P3Nh6AzSay7fi127tyJTZtuxzO/+g0+/OTgBbTLZ9MYW7cGDz64C+vXr6eXWti65Q6s4/u//PX1roHL4bmWSlBmGEl6ic7DfHGmzn+7fHiIgNfh6MQEkokEGo0GEvEkvv3IwxjofxMfHziIUrmKvmIBt91yM269dSO2b9sOy7JQrdVQKBTQJHjf97FsoB/Hjk12DTwIAhqUwC8ZVOdZe+H54ZEhOK6reJ4gcJvuq9drqNfqKpCeePy7yBPcyPAwMpks9v59L/bs2YOJo0fVZR94YCdy+by6YkiufZFw1rtTJe0cieolNx3bQTqdJrCMsoLHbCsLsGjJY8eOw2Xg1UmB/fv348OPPoLtONiwYQPuvmcbDNNU84VSIQMsFo+1Xb3YWHCYiwmx4nmHSTrfS5CJtV1DR7XSxOT0NGrVKmZnZ9Fs0v1cRKlUwsTEURw6dBCVSgXNUhn+mhAZ0iLOxXpUst7eIqamp7Br1wN47PHv4aP3/41XXn4Nc5V6V7qurVw7Hrmu/bmiaO3ladrnbF+TTeGuhIl+0iBBS7kMtk+HBlGn1SPdQKtcAokLI53BXJnKQotuHB9HEAYqDopvvoVhx8b0yAgaY2PIr1qF4cFBxkARfTRC48wZvLr/fRw6eVpRZ7FjaPUGGIXegacl1V8O+CjT7fqTx7GdgG6m+a+rNzF05DBSh48gdfC/+OqOHbjpa7tQrlUxQE7P7XsXhxmINVo6xhhIkyK38PuHyjUsO3ESNXqJmoh7du+GduoUBn7/B4zl8qjSGzM0RriIrmeZPS8LfJ7bPf055CanUCLoWDKJFYUiBnJFrKSSxB7ZjW/87rdYv2YN+uiFM88/h8dsHwa9ktu6FWNrr8fw6tWwNm5EtHIFNrNkvY/8X3XiFFrv/ZMBbiIZarhPM3Efg32wN4tJQ0PVaRd7F6N518B7swn0MmEk+F2J/Myms7RQAZ+sHsXst76OSdKhd3AI0/v24cY33sHd4zfhdtfHsUoZ+TvvwOiyZVizciUGtmxBbcsmNFiq5iihg4yX7JlZpAsZ1HoY5MU8bsiksSObwV7GS5PliJKhBUMQSb1idqWdZkK5z5MP1N4PTp+Az8/1uI7mz34OSZ9v/fAHGHr7Xdw6OEzuW3CYlu+aLeE/Bz/FPT9+EklJGrSoQepM37IRnz39FG5gpk1J6UrFifyAtbfL6wew6i2EQXTJ9H9xVbmIBDbYwulxEzrBUv5Zqfn4ePI4RppNbBsaQj6Vwst/ex0Znj/Wl4cTNyhxcYwu74dFPrsMaLlamVLpMhhblMCEGYNus04iEJeWbeduTQGSlKid38VgMTk8XxH54Uzdwmer1yJz+DCyDFAhVoIgJ2tlrLhhDIMMvHspiSKR/YUe0U2YuglTsnK1hokjR5BLpeFQWUS7LQHJxcs8FYj6AgZHlFwObRFxMbtNs82ePI6zIIuFCfTT5YFUiHK7ah2hE2KAVNBYu7SoCjE2uZEesZZh70hrz01NQxscYJ3hKp1v8LssX32hB62vd4JQ1U1eAIO9AcX+ywOf59YwrX2CNw9JgxV8H/CGFm8QZXTlchCo5GJfyk1qeNzQVQFXqZSgmwazqdM2AgHGWB7YTFQVfi6z+xIaWTw/y+z7xrIR1dIvCXAaBxnePM2Ec4JgpYIfJXjba0d+ZMxHvaa2MwJ+LyBZN6NOusQYrBIbqrLj7/41eRIf7n8PLRZMPlXN5G9zlMYytfyDch2u3HApgLdcuo8anuMFR3mT41JryNYArRsXuMJnqVk4r0GvNGm9CiXvSKuJgIClCVANAxflUFLTfL+a+aBY7EUPgzsXT6BACr5Nvr94cmpRPF0Dt2WbgBeP+5aqx/O8yQTB72e6d2nVMjNlg4CqjqVKAbF2nDg90qWn2SBlfXrBVcFZ40LG+wZw73oDDq2v1sN/capLiR7xFrH2lVGFkR6Q2yYBSrGlEfg4b3JwZgb7qChDUuLGYljN5NTfP4ReuryX8w/PzeHNuRLSTFAScGL1ltQ7BOmJ9blAkcKAnpPaZtb1usLTNXDhXMSsFqtUVVaN1GIirCV9tm0YJ+CMCk6dnBWJkOZEVCNjVBDU66rrEeABwVaEPqSSw3kO2tt74omIqtUwzaUFLq6fYBU5bsrGTBu4TovbomKiwyKRBOBHgToXdDZETJ7yqhXUmKxYsKuuRzKrTpBhp2JW80UWeQ+ny65iceCqH1UwcYrcPbtt0elCRMsdgnHpZpHEEBHO/oITE1QKrdFUdbkA9zi3RrqZBNlp3ZXayL5OGHhoBcGXBx4SjGxfSJcifV6dAdrijVKdPBd1FiYqYXOuWH1h9pXzaYkL0mSGNbdJeviSOSVrqgSjq3tElMNI7RNSlfTuTH7Z1k2nZusEIxYJeOEqL1wN1XboOWVmQPkLWM/M74QJYJFKoU6CbVmSIIXjXofjGodBlQklWPkaibTKZ+ljsURUMWNxFTwerSWlksWb2lxASqwr1OBnKaIC2Q2jGQwqy1mKcRj0VJoWFcUIwjaFhC6R43RKKaFKQOAu0z0XkoyWLjhj1G+xr8PAOxRoKAbtAFT85juPgELKmM/KKBkm1VyVbOgByaJZvoZBexPEU0nKVV5y+TuLC5KF+3w1xCjeEsuhgBdq/IMgVjCQrhNL0+KecFz4zRG2pIiiHVmyRmqPm+c4P0mL25RAkUcpslzSrlavYY6Wtzpba6JQjlAmX1ha4GfBM3heatTwmO+gvyNjQp2IIKXplqwnm5LCdqFHy2/TxM5lVQ2uVImjTZ1QKZGUC5JZZcvD6/KRjam2HKB1/aREOB/kevACa/HvE7y4tyUcVlvBIVWIXO+0Wao14PkMFyfzxBsSEz7rmYjBLGBt2cjk9GoygVImibpKQO5lBUNEgG2NrhIKruDhlEHL+YU+PF8v41GnpVzc5CLmt4OFDp4C2tZkW9ox1u1gMWUyu5qsdfYXe/AOs+5pGqKqGbBk11eoU7cvbzj+RuKGFWYMrs6eJMAVHSKTTqEXz835eIKcnSVnNbraJfJ6yCSTSGGO7V6JgGYKeSTyeUWppsPsSIu/qvK9o8L7yuiaVB4zpTc0HLP97GdehLtMu5KUooFhPGs1sHmoD6G0Z2zZHMZCyXJQZo1ipZy2wkyXsRRHLJmmdBK4bBXLIzl5uiUBc+UPC8jRVBZv12i5moOreSSz+XZCtD1RIS2KJ5KKt9rCdBtdqwebXcYVax7ZCPKapKRuBJLyj5oxtsB0QbFvBGYidc4Dr/+HQ5Ssb/koXKsplhZoB4zB5aMzfHMbU3VPMpXRhpavUo8NHbup0H/+VGLBTsuCvfNuH2p90SNHKw9fdz1c4glcmwKoHZdnswL8M8nEvPUWFlIpi64oDo0g39OvEo7BYFPP86PoosCXGrxQIpXLI0e57V22AulcAZWZUyzyXAE9wSk/nX8kLsL5J9m95Xico68yc1o3yftUJocC2zAJCBH+a3FImStNt2u1YDfrrDpt2X8q8ZRY+gWOP0tS/p8AAwBF79Lwq6KvCwAAAABJRU5ErkJggg==',
            'GroupChat': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAuCAYAAABXuSs3AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABTJJREFUeNrUmftrHFUUx8+9c2d3Z5PNownZtrGmr2jaImgNPvAHwR9EEIqK1UoqwVIlUMFS9IeK+IuI/iAqgiBWGmpafCEV/R9ErA34Sh8/qFVQWVFjNrs77+s5szub6e6mme3OTJObnMwwM5n7mXO/99xz72U33Xa3AgASbQztWbR7pYT1tmUopmGC41ggXRekpEfiL4wxYJyDoqiQSqdAqGm85t36F+15tGNorqBn0e5CexntdtsyVUPXwdQr4Lo2uJK+yq1+WiLk+Cs5cF4B0xSQSmmQzmj4AWo/3n0R7U+0zwn8HrTX0aE7TL3MK5VFsC0LURHWbXwnix9cVv+4VL2Nre24YFk6aFo3pLXsBrz5KsET+FG0HQZClxeLYKM0ICCLOiyD5AtiONIBx3IhnVVAMo6t4Y7inTcJ/E6UBzcqZdSz3QzNWviaJQfuH/XSAuTWDYJR/I8rCh8XUrpp0rRlGcjsNnk5CB9SopHq3S8km+LfBejqHwSnXFSEbVq1jtgo6Bp+rUsHz69cVwzNgSog55cX5kHL9YFUFOAoE9SR3SSPy6DpuAw0a/iJKUZWGbBgAAGOoVJY1HPdRmh2OXQ7nmXxxngbZZ3t6QNBcYfVmiIg7GWhWwInGHEss+INUMKVNLzIBubW/my6ypL/Asdx0KEIvjwUawk9vvsW2D/xKOzaOQb5oaGOIAqFv+DchYswc+pDOPPNbHuy2bRtpzRNvUnfQZn40E9M7odnnp7C4ZhyCcU7soZn2wsW1Zam97zx1tvwzrHjoeJ6fuvYksdXau1bd98Mh6YOepWoKvZqIergnUU66b3juSOH4ezst3Dm7GyouM7DxuWpJw94XiYj6EaPd24ARw4fCv3BIuyD27ZuqTerN5I1DlgRlBtHR6MBD3bY7u6uuiyoeePIz706QqYv4TzOqmGIvByHp4MDzEppBas5TLQTPwmajnF4O3Qnrz0nwiZLBOzbNQW/klRa5d5JgLcDH1oqvkzWHPia9XhxcdEbeGzbrsfyqKF1TFkjB7906Tfo6+31JBO1xwmanHHu/MXQ/xPadSdOflCXCnk9CguODZZlwbvHT0QP/t0PczD9/ql6Rb4FtR80/74/yq5k703PwPdYR+RSofLRJ6dh7vwFeO2Vl+pDf6uR1NcsNf9Ksvryq6/h09NfoGN+7DAfZ7VpL+MNQZ0FVimWev9nH8+0zPYImuy+PXsjj0BDm2+AjsNDuVwGwzCachnydBzQbWt8uWKaZh3alwWd3//gvljnnh2Dt+qAex6eiH3S3DE4gQancA888ngiyxQdg9MUzv+Ah/ZNJra+0jE4pQFU9k4cgCRLJEnHY5NPQdKFjWzfJU1Dr87lriKOh13FjczTXIGBTVuARgmQ7FpsN1ylNDMZbzONC6EC42uGG9RUBmzTAK6mUhgZRPP8f7WCZ7Le7gSnRXLakvPD2moume4e4MTpEDhnMpXOgOJJhgVHllUFTaro7h8Eq7SAnIpD6v5ZqKqbxiboH9gIIq2tOsUINQUDwyNgVkrkaUKbU4aGRwp4Mq6oal9G62L54c3etqGhlzz6pQlsYKWFJRcOc+jlDddvBxN5HFPHAMh+xctHCfwnPLGw6jsc29Iq2BT9+Y3Q0zeIPTgNChfV/XxaDm4BHjU8SULL9UCudwDWrb8OsrlemC/8Do5tEvQv+MgLUNsSp6n1NFoe7SDawHzhDy5Q91pXDnoH816HoMCfRHFdTJExTTYrZdBLRXAM3UbP/IO3yNMnaSJGqyX/CzAA5nefmPKQ4Q8AAAAASUVORK5CYII=',
            'Community': 'data:image/png;base64,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',
            'Halloween2012': 'data:image/png;base64,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',
            'Halloween2013': 'data:image/png;base64,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',
            'TriviaKnight': 'data:image/png;base64,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'
        }
    };

    var locationURI = window.location.href.split(/[\/#\?]+/);

    var page = {
        'section': locationURI[2],
        'id': locationURI[3],
        'name': locationURI[4],
        'number': 1,
        maxItemsPerPage: {
            'default': 40,
            'topic': 40,
            'giveaway': 40,
            'forum': 40
        },
        'maxPages': 1
    };

    if (page['name'] == null || page['name'].trim() == '') {
        page['name'] = 'name';
    }

    if (page['id'] == null) {
        page['id'] = 'id';
    }

    if ($('.numbers>.selected:first').length) {
        page['number'] = parseInt($('.numbers>.selected:first').text());
    }

    var pageLoading = false;
    var pageAdding = false;
    var pageContent = null;
    var pageAddingPaused = false;

    var giveawayFilteringDone = true;

    var giveawaySearch = '';

    var thisTopic = {
        'newCommentCount': 0,
    };

    var staff = [
        'bobofatt',
        'cg',
        'crossbourne',
        'lorkhan',
        'rinarin',
        'thejadefalcon',
        'theshobo'
    ];

    //Default config option values. ge = general, ge_be = better editor, gi = giveaway, gi_f = giveaway filter, f = forum, u = user, a = advanced.
    var config = {
        'ge_notifyupdate': true,
        'ge_highlightunread': true,
        'ge_comments_ids': true,
        'ge_comments_highlightop': true,
        'ge_floatdown_menu': true,
        'ge_be_bettereditor': true,
        'ge_be_livepreview': true,
        'ge_be_formatbuttons': true,
        'ge_be_newlineparse': false,
        'ge_rowpadding': 12,
        'ge_postpadding': 17,
        'ge_comments_imagehover': true,
        'gi_endlessscrolling': true,
        'gi_endlessscrolling_seamless': false,
        'gi_highlightwishlist': true,
        'gi_hidefeatured': false,
        'gi_replacefeatured': true,
        'gi_showwinchance': true,
        'gi_quickview': true,
        'gi_gridview': false,
        'gi_f_showpublic': true,
        'gi_f_showgroup': true,
        'gi_f_showentered': true,
        'gi_f_limitpoints': false,
        'gi_f_wishlistonly': false,
        'gi_f_dlc': false,
        'gi_f_entrylimit_enabled': false,
        'gi_f_entrylimit_percopy': false,
        'gi_f_entrylimit_value': 100,
        'gi_f_minimumcopies': 1,
        'gi_f_minimumchance': 0,
        'gi_f_contributor_green': true,
        'gi_f_contributor_red': true,
        'gi_f_contributor_value_min': 0,
        'gi_f_contributor_value_max': 5000,
        'gi_f_enabled': true,
        'gi_f_library_enabled': true,
        'f_endlessscrolling': true,
        'f_endlessscrolling_seamless': false,
        'f_markreplied': true,
        'f_newestfirst': true,
        'f_highlightstafftopics': true,
        'u_awards': true,
        'a_unreadcommentexpire_value': 4
    };

    var configCache = {};

    var usertags = {};
    var ignoredUsers = {};
    var giveawayFilters = {}

    var now = Date.now();

    var sgpFloatDownMenuOn = false;

    //Initialize.
    userInit();
    styleInit($('html'));
    compatibilityInit();
    configInit();

    //Control panel links.
    if (user['loggedIn']) {
        $('ul:contains(View Profile):first', '#navigation').append('<li><a href="/steamgiftsplus">SteamGifts Plus</a></li>');
    } else {
        $('li:contains(Forum)', '#navigation').after('<li><a href="/steamgiftsplus">SteamGifts Plus</a></li>');
    }
    $('div.right', '.footer_sm').prepend('<a href="/steamgiftsplus" style="margin-right:15px;">SteamGifts Plus</a>');

    floatDownMenuInit();
    commentPreviewingInit($('body'));

    /**
     * Endless scrolling page loaded - add page content.
     */
    function sgpAddpageContent() {
        var obj = pageContent;

        if (obj != null && !pageAdding) {
            pageAdding = true;
            switch (page['section']) {
                case 'giveaway':
                case 'forum':
                    if (page['id'] != 'replies' && page['id'] != 'new' && page['id'] != 'edit') {
                        //Are we a topic or the forum index?
                        if (locationURI.length > 4 && page['id'].length == 5) {
                            //Topic.

                            //Newest first order fix for comments. (aka done badly, needs to be rewritten/refactored).
                            if (configGet('f_newestfirst')) {
                                if (!configGet('f_endlessscrolling_seamless')) {
                                    obj.find('.parent_container:last').prepend('<div class="sgpRowPage"><center>Page ' + page['number'] + ' of ' + page['maxPages'] + '</center></div>');
                                }
                                $('body').append('<div id="sgpTempReverse"></div>');
                                obj.find('.parent_container').reverse().appendTo('#sgpTempReverse');

                                doComments($('#sgpTempReverse'), true);
                                doBetterCommentEditor($('#sgpTempReverse'), true);

                                $('#sgpTempReverse').find('.parent_container').insertAfter('.comment_container:first .parent_container:last');

                                $('#sgpTempReverse').remove();
                            } else {
                                if (!configGet('f_endlessscrolling_seamless')) {
                                    obj.find('.parent_container:first').prepend('<div class="sgpRowPage"><center>Page ' + page['number'] + ' of ' + page['maxPages'] + '</center></div>');
                                }

                                doComments(obj, true);
                                doBetterCommentEditor(obj, true);

                                obj.find('.parent_container').insertAfter('.parent_container:last');
                            }
                        } else {
                            //Forum Index.
                            doForum(obj);

                            if (!configGet('f_endlessscrolling_seamless')) {
                                $('.discussions:last').append('<div class="sgpRowPage"><center>Page ' + page['number'] + ' of ' + page['maxPages'] + '</center></div>');
                            }
                            obj.find('.row').appendTo('.discussions');
                        }
                    }
                    break;
                case '':
                case 'open':
                case 'new':
                case 'coming-soon':
                case 'closed':
                    //Remove featured/developer/greenlight giveaways.
                    obj.find('.post:not(.ajax_gifts .post)').remove();

                    doHome(obj, true);

                    if (!configGet('gi_endlessscrolling_seamless')) {
                        $('.post:last').after('<div class="sgpRowPage"><center>Page ' + page['number'] + ' of ' + page['maxPages'] + '</center></div>');
                    }

                    filterGiveaways(obj);

                    obj.find('.post').css('display', 'none').appendTo('.ajax_gifts');

                    $('.pagination:last, .sgpRowPage:last').appendTo('.ajax_gifts');
                    break;
            }

            if ((!configGet('f_newestfirst') && page['number'] >= page['maxPages']) || (configGet('f_newestfirst') && page['number'] == 1 && page['section'] == 'forum' && locationURI.length > 5) || (page['section'] != 'forum' && page['number'] == page['maxPages'])) {
                $('#sgpNextPageLoading').replaceWith('<div style="text-align:center;"><p>You\'ve reached the end.</p></div>');
            }
        }

        pageAdding = false;
        pageLoading = false;
        pageContent = null;
        pageAddingPaused = false;

        endlessScrollingCheck();
    }

    /**
     * Endless scrolling page loaded.
     */
    sgpPageLoaded = function(data) {
        if (data == null || data == '') {
            return
        } else {
            var obj = $(data);

            pageContent = obj;

            endlessScrollingCheck();
        }
    }

    //Page specific stuff.
    switch (page['section']) {
        case 'support':
            usertags = lscache.get('usertags');
            if (usertags == null) {
                usertags = {};
            }
            ignoredUsers = lscache.get('ignoredUsers');
            if (ignoredUsers == null) {
                ignoredUsers = {};
            }
            if (locationURI.length > 4) {
                doComments($('body'), false);
            }
            doSupport();
            doBetterCommentEditor($('body'), false);
            break;
        case 'feedback':
            doFeedback();
            break;
        case 'manage':
            doManage();
            break;
        case 'forum':
            usertags = lscache.get('usertags');
            if (usertags == null) {
                usertags = {};
            }
            ignoredUsers = lscache.get('ignoredUsers');
            if (ignoredUsers == null) {
                ignoredUsers = {};
            }
            if (page['id'] == 'replies') {
                $('.markdown[style*="background-color:#E2E5E7;"]').each(function() {
                    var topicURL = $(this).children('a:first').attr('href');
                    //Newest first.
                    if (configGet('f_newestfirst')) {
                        if (topicURL.match(/\/forum/)) {
                            $(this).children('a:first').attr('href', topicURL + '/page/31337');
                        }
                    }
                });
                doComments($('body'), false);
            }
            if (page['id'] != 'replies' && page['id'] != 'new' && page['id'] != 'edit') {
                endlessScrollingInit();
            }
            if (page['id'].length != 5) {
                doForum($('.discussions'));
            } else {
                //Newest first.
                if (configGet('f_newestfirst')) {
                    $('div#comment_form').insertBefore('.comment_container');
                    $('div#comment_location').insertBefore('div#comment_form');
                    $('.parent_container').reverse().appendTo('.comment_container');
                }

                doComments($('body'), false);
            }

            doBetterCommentEditor($('body'), false);
            break;
        case 'user':
            usertags = lscache.get('usertags');
            if (usertags == null) {
                usertags = {};
            }
            ignoredUsers = lscache.get('ignoredUsers');
            if (ignoredUsers == null) {
                ignoredUsers = {};
            }
            doUser();
            doBetterCommentEditor($('body'), false);
            break;
        case 'giveaway':
            usertags = lscache.get('usertags');
            if (usertags == null) {
                usertags = {};
            }
            ignoredUsers = lscache.get('ignoredUsers');
            if (ignoredUsers == null) {
                ignoredUsers = {};
            }
            doGiveaway($('body'));
            doComments($('body'), false);
            doBetterCommentEditor($('body'), false);
            break;
        case '':
        case 'open':
        case 'new':
        case 'coming-soon':
        case 'closed':
        case 'search':
            usertags = lscache.get('usertags');
            if (usertags == null) {
                usertags = {};
            }
            ignoredUsers = lscache.get('ignoredUsers');
            if (ignoredUsers == null) {
                ignoredUsers = {};
            }
            giveawayFilters = lscache.get('giveawayFilters');
            if (giveawayFilters == null) {
                giveawayFilters = {};
            }
            //Legacy support. Convert library filters to new format.
            var giveawayLibraryFilters = giveawayFilters['libraryFilters'];
            if (giveawayLibraryFilters == null) {
                giveawayLibraryFilters = {};
                giveawayFilters['libraryFilters'] = giveawayLibraryFilters;
            }

            for (var key in giveawayFilters) {
                if (giveawayFilters[key] && key != 'libraryFilters') {
                    giveawayFilters['libraryFilters'][key] = true;
                    delete giveawayFilters[key];
                }
            }

            endlessScrollingInit();
            doHome($('body'), false);
            if (page['id'] != 'search' && page['section'] != 'search') {
                doFilterControls();
                filterGiveaways($('body'));
            }
            break;
        case 'steamgiftsplus':
            usertags = lscache.get('usertags');
            if (usertags == null) {
                usertags = {};
            }
            ignoredUsers = lscache.get('ignoredUsers');
            if (ignoredUsers == null) {
                ignoredUsers = {};
            }
            giveawayFilters = lscache.get('giveawayFilters');
            if (giveawayFilters == null) {
                giveawayFilters = {};
            }
            doControlPanel();
            break;
        case 'sync':
            doSync();
        case 'create':
            doBetterCommentEditor($('body'), false);
            break;
    }

    //Giveaway Ended Notifcation
    giveawayEndedNotify();

    //Updates.
    updateAwards(false);
    updateWishlist(false);
    updateLibrary(false);
    updateDLC(false);

    //Endless Scrolling
    endlessScrollingCheck();

    //Update notification.
    if (lscache.get('addonLastVersion') !== addon['version']) {
        notifyUpdate();
        //Force update everything.
        updateAwards(true);
        updateWishlist(true);
        updateLibrary(true);
        updateDLC(true);
        lscache.set('addonLastVersion', addon['version']);
    }

    /**
     * Initialize user.
     */
    function userInit() {
        if ($('a:contains(View Profile)', '#navigation').length) {
            user['loggedIn'] = true;
            user['username'] = $('a:contains(View Profile)', '#navigation').attr('href').match('[^\/]*$');
            user['points'] = parseInt($('a:contains(Account)', '#navigation').text().trim().replace(/([^0-9]*)/g, ''));
        }
    }

    /**
     * 'compatability' with Zo's addon.
     */
    function compatibilityInit() {
        setTimeout(function() {
            if ($('script[src*="enhancement_addon_base.js"]').length) {
                $('.content:first', '.wrapper').prepend('<div class="sgp_alert_warning" style="background-color: #CC0000;font-weight: bold;border: 0 none;border-radius: 15px 15px 15px 15px;color: #FFFFFF;font-size: 12px;line-height: 31px;margin-bottom: 25px;text-align: center;box-shadow: 0 10px 10px rgba(255, 255, 255, 0.4) inset;">Zo\'s Enhancement Addon detected! Please disable it! It\'s not compatible with SteamGifts Plus.</div>');
            };
        }, 500);
    }

    /**
     * Initialize Control Panel.
     */
    function controlPanelInit() {
        //Unread comment slider.
        $('#sgpUnreadCommentExpireSlider').slider({
            min: 2,
            max: 8,
            step: 1,
            value: configGet('a_unreadcommentexpire_value'),
            slide: function(event, ui) {
                $('.sgpUnreadCommentExpireRange').text(parseFloat(ui.value).toFixed() + ' Weeks');
            },
            stop: function(event, ui) {
                configSet('a_unreadcommentexpire_value', parseFloat(ui.value).toFixed());
            },
            create: function(event, ui) {
                $('.sgpUnreadCommentExpireRange').text(configGet('a_unreadcommentexpire_value') + ' Weeks');
            }
        });

        filterControlsInit();

        //Load game filters.
        loadGameFilters();

        //Load tagged users list.
        for (var key in usertags) {
            var usertag = usertags[key]['usertag'];
            var color = usertags[key]['color'];
            $('<div class="sgpTaggedUser" name="' + key + '"><a href="http://www.steamgifts.com/user/' + key + '"><span>' + key + '</span></a> <span style="color:' + color + '; font-weight:bold;">' + usertag + '</span><a class="sgpRemoveListItem" href=""><img style="margin-bottom: -2px; width: 12px; height: 12px;" src="http://www.steamgifts.com/img/verify_error.png" title="Remove"></a></div>').prependTo('.sgpTaggedUsersList');
        }

        //Load ignored users list.
        for (var key in ignoredUsers) {
            var reason = ignoredUsers[key];
            $('<div class="sgpIgnoredUser" name="' + key + '"><a href="http://www.steamgifts.com/user/' + key + '"><span>' + key + '</span></a> <a href="' + reason + '">' + reason + '</a><a class="sgpRemoveListItem" href=""><img style="margin-bottom: -2px; width: 12px; height: 12px;" src="http://www.steamgifts.com/img/verify_error.png" title="Remove"></a></div>').prependTo('.sgpIgnoredUsersList');
        }
    }

    /**
     * Initialize endless scrolling.
     */
    function endlessScrollingInit() {
        $('.pagination:first').after('<div class="sgpRowPage" style="background-image: none;"></div>');
        $('.sgpRowPage:first').hide();

        var configEndlessScrollingForum = configGet('f_endlessscrolling');
        var configEndlessScrollingGiveaway = configGet('gi_endlessscrolling');

        if ((configEndlessScrollingForum && page['section'] == 'forum') || (configEndlessScrollingGiveaway && page['section'] != 'forum' && page['id'] != 'search')) {
            var itemsPerPage = page['maxItemsPerPage']['default'];
            if (locationURI.length > 4) {
                switch (page['section']) {
                    case 'forum':
                        itemsPerPage = page['maxItemsPerPage']['topic'];
                        break;
                    case 'giveaway':
                        itemsPerPage = page['maxItemsPerPage']['giveaway'];
                        break;
                }
            }

            if ($('.results').length) {
                var maxPages = $('.pagination>.results:first').text().replace(/,/g, '').match(/\d*\s*results/);
                if (maxPages == null) {
                    maxPages = 1;
                }
                page['maxPages'] = Math.ceil(parseInt(maxPages.toString().replace(/([^0-9*])/g, '')) / itemsPerPage);
            }

            if (locationURI[6] == 31337) {
                page['number'] = page['maxPages'];
            }

            $('.pagination:last, .pagination:first').hide();

            if (page['maxPages'] == 1 || (page['section'] == 'forum' && page['number'] <= 1 && configEndlessScrollingForum && configGet('f_newestfirst') && page['id'].length == 5) || (!configGet('f_newestfirst') && page['id'].length == 5 && page['number'] >= page['maxPages'])) {
                $('.pagination:last').after('<div class="sgpRowPage"><center>You\'ve reached the end.</center></div>');
            } else {
                $('.pagination:last').after('<div class="sgpRowPage"><div id="sgpNextPageLoading"><center><img src="' + image["loadinggif"] + '"><p>Loading next page...</p></center></div></div>');
            }
            $('.sgpRowPage:first').replaceWith('<div class="sgpRowPage" style="background-image: none;">Page ' + page['number'] + ' of ' + page['maxPages'] + '</div>');
            $('.sgpRowPage:first').show();
        }

        var value = configEndlessScrollingGiveaway;
        var id = 'gi_endlessscrolling';
        if (page['section'] == 'forum') {
            id = 'f_endlessscrolling'
            value = configEndlessScrollingForum;
        }

        //Display controls.
        var checked = value ? ' checked' : '';

        if (page['id'] != 'search') {
            $('.pagination:first, .sgpRowPage:first').append('<div class="sgpDisplayControls"> <div class="sgpCheckbox' + checked + '" id="' + id + '"> Endless Scrolling</div></div>');
        }

        if ((page['section'] == '' || page['section'] == 'open' || page['section'] == 'new' || page['section'] == 'coming-soon' || page['section'] == 'closed') && page['id'] != 'search') {
            checked = configGet('gi_gridview') ? ' checked' : '';
            $('.sgpDisplayControls').append(' <div class="sgpCheckbox' + checked + '" id="gi_gridview"> Grid View</div>');
        }

        if (page['section'] == 'forum' && locationURI.length > 4 && page['id'].length == 5) {
            checked = configGet('f_newestfirst') ? ' checked' : '';
            $('.sgpDisplayControls').append(' <div class="sgpCheckbox' + checked + '" id="f_newestfirst"> Newest Comment First</div>');
        }

        $('.sgpDisplayControls').after('<div class="clear_both"></div>');

        //Vertical compression.
        if (page['id'].length != 5) {
            //Slider doesn't work on forum /page/'s because cg is including jquery UI twice.
            if (page['section'] == 'forum' && page['id'] == 'page') {
                return;
            }

            $('.sgpDisplayControls:first').prepend('<div id="sgpPaddingControls" style="display: inline-block;">Spacing:<div id="sgpPaddingSlider" style="margin-top:5px; width: 100px; display: inline-block; margin-right: 10px; margin-left: 10px;"></div></div>');

            if (value) {
                $('#sgpPaddingControls').prependTo('.sgpDisplayControls:last');
            }

            //Vertical compression.
            var sliderValue = configGet('ge_postpadding');
            var sliderMax = 17;
            if (page['section'] == 'forum') {
                sliderValue = configGet('ge_rowpadding');
                sliderMax = 12;
            }

            $('#sgpPaddingSlider').slider({
                min: 0,
                max: parseInt(sliderMax, 10),
                animate: true,
                value: parseInt(sliderValue),
                slide: function(event, ui) {
                    if (page['section'] == 'forum') {
                        $('.row').css('padding', ui.value + 'px 0');
                    } else {
                        $('.post:not(.post[style*="227, 236, 245"]):not(.post[style*="#E3ECF5"])').css('padding', ui.value + 'px 0');
                        $('.post[style*="227, 236, 245"], .post[style*="#E3ECF5"]').css('padding', ui.value + 'px 15px 0px 15px');
                    }
                },
                stop: function(event, ui) {
                    if (page['section'] == 'forum') {
                        configSet('ge_rowpadding', ui.value);
                    } else {
                        configSet('ge_postpadding', ui.value);
                    }
                }
            });
        }
    }

    /**
     * Initialize float down menu.
     */
    function floatDownMenuInit() {
        $('.bg_gradient').after('<div style="position: absolute; top: 0px;"><div class="sgpFloatDownMenu"><div style="margin:0 auto;width:1000px;" id="sgpMenuWrapper"></div></div></div>');
        $('#sgpMenuWrapper').prepend($('#navigation').last().clone());
        $('.sgpFloatDownMenu ol').hide();
        $('.sgpFloatDownMenu .search').remove();
        $('#sgpMenuWrapper>#navigation>ol').css('width', '820px').append('<li style="float: right;"><a href="" id="sgpBackToTop">Back to Top</a></li>')

        $('#sgpMenuWrapper .logo').css('background-image', $('#navigation').last().find('.logo').css('background-image'));
        $('.sgpFloatDownMenu').css('background-image', $('.bg_gradient').css('background-image'));

        $("#sgpMenuWrapper li a.arrow").live('click', function() {
            var b = $(this);
            b.parent().siblings().removeClass('open');
            b.parent().siblings().children('.relative-dropdown>.absolute-dropdown').hide();
            b.parent().addClass('open');
            b.siblings('.relative-dropdown').children('.absolute-dropdown').show();
            return false;
        });

        $("#sgpMenuWrapper #navigation ol>li").mouseleave(function() {
            $('#sgpMenuWrapper #navigation ol li').removeClass('open');
            $('#sgpMenuWrapper #navigation ol li .absolute-dropdown').hide();
        });

        if (configGet('ge_floatdown_menu') && !sgpFloatDownMenuOn && window.pageYOffset > 90) {
            sgpFloatDownMenuOn = true;
            $('.sgpFloatDownMenu').stop(true, true).slideDown('slow', function() {
                $('.sgpFloatDownMenu ol').show();
            });
        }
    }

    /**
     * Change the color of the giveaway ended message.
     */
    function giveawayEndedNotify() {
        var notify = $('.alert:contains(giveaways has ended)', '.content');
        if (notify.length) {
            notify.css({
                'background-color': '#9abacb',
                'border': '1px solid #7e9eab',
                'color': '#ffffff',
                'text-shadow': '1px 1px #6B878F',
                'background-image': 'url("' + image["nofityBGBlue"] + '")'
            });
            notify.children('a').css('color', '#ffffff');
        }
    }

    /**
     * Better Comment Editor
     * @param {Object} obj The object to do stuff with. Should be this page or an iframe's contents.
     * @param {boolean} endlessPage Whether we're doBetterCommentEditor'ing an endless scrolling page.
     */
    function doBetterCommentEditor(obj, endlessPage) {
        if (configGet('ge_be_bettereditor')) {
            if (!endlessPage) {
                var checkedLivePreview = configGet('ge_be_livepreview') ? ' checked' : '';
                var checkedParseLineBreaks = configGet('ge_be_newlineparse') ? ' checked' : '';
                if (page['section'] == 'user') {
                    obj.find('label[for="notes"]').append('<span style="float: right; font-size: 12px; font-weight: normal;"><div class="sgpCheckbox' + checkedLivePreview + '" id="ge_be_livepreview"> Live Preview</div> <div class="sgpCheckbox' + checkedParseLineBreaks + '" id="ge_be_newlineparse"> Parse Line Breaks</span>');
                    obj.find('label[for="notes"]').css('margin-bottom', '0');
                    obj.find('label[for="notes"]').after('<div class="sgpBetterCommentEditor"></div>');
                    obj.find('form[id="create_form"]').append('<div id="commentPreview"><div class="clear_both"></div><div class="divider" style="margin:12px 0;"></div><div class="icon body_icon"></div><div class="input"><label>Live Preview</label><div class="discussions"><div class="body markdown sgpPreview"></div></div></div><div class="clear_both"></div></div>');
                } else if (page['section'] == 'create') {
                    obj.find('label[for="body"]').append('<span style="float: right; font-size: 12px; font-weight: normal;"><div class="sgpCheckbox' + checkedLivePreview + '" id="ge_be_livepreview"> Live Preview</div> <div class="sgpCheckbox' + checkedParseLineBreaks + '" id="ge_be_newlineparse"> Parse Line Breaks</span>');
                    obj.find('label[for="body"]').css('margin-bottom', '0');
                    obj.find('label[for="body"]').after('<div class="sgpBetterCommentEditor"></div>');
                    obj.find('form[id="create_form"]').append('<div id="commentPreview"><div class="clear_both"></div><div class="divider" style="margin:12px 0;"></div><div class="icon body_icon"></div><div class="input"><label>Live Preview</label><div class="featured" style="padding: 0;"><div class="body markdown sgpPreview" style="background-color:#2A333B;margin-top:0px;"></div></div></div><div class="clear_both"></div></div>');
                } else if ((page['section'] == 'forum' && (page['id'] == 'new' || page['id'] == 'edit')) || (page['section'] == 'support' && (page['id'] == 'new' || page['id'] == 'edit'))) {
                    obj.find('label[for="body"]').append('<span style="float: right; font-size: 12px; font-weight: normal;"><div class="sgpCheckbox' + checkedLivePreview + '" id="ge_be_livepreview"> Live Preview</div> <div class="sgpCheckbox' + checkedParseLineBreaks + '" id="ge_be_newlineparse"> Parse Line Breaks</span>');
                    obj.find('label[for="body"]').css('margin-bottom', '0');
                    obj.find('label[for="body"], label[for="notes"]').after('<div class="sgpBetterCommentEditor"></div>');
                    obj.find('form[id="create_form"], #sgpUserReport').append('<div id="commentPreview"><div class="clear_both"></div><div class="divider" style="margin:12px 0;"></div><div class="icon body_icon"></div><div class="input"><label>Live Preview</label><div class="discussions"><div class="body markdown sgpPreview"></div></div></div><div class="clear_both"></div></div>');
                } else {
                    obj.find('#comment_form form:first').after('<div class="comment child" id="commentPreview"><div class="child_container"><div style="color: #4F565A; font-size: 12px; text-shadow: 1px 1px #FFFFFF; word-wrap: break-word;"><span style="color: #347DB5;font-size: 12px;font-weight: bold;padding-bottom: 15px;">Live Preview</span><div class="body markdown sgpPreview"></div></div></div></div>');
                    obj.find('#comment_form .body_container:first').before('<div class="sgpBetterCommentEditor"></div>');
                    obj.find('#comment_form .comment_reply').append(' <span style="font-size: 12px; font-weight: normal; color: #4F565A;"><div class="sgpCheckbox' + checkedLivePreview + '" id="ge_be_livepreview"> Live Preview</div> <div class="sgpCheckbox' + checkedParseLineBreaks + '" id="ge_be_newlineparse"> Parse Line Breaks</span>');
                    if (page['section'] == 'giveaway') {
                        $('.body.edit_gift').after('<div id="commentPreview"><h4 style="color: #98B8D5;font-size: 14px;line-height: 20px;padding:5px 0px 0px 10px;margin-bottom:-20px;">Description Preview</h4><div class="body sgpMarkdown sgpPreview"></div><div class="clear_both"></div></div>');

                        $('.edit_gift_hide').click(function() {
                            $(this).parents('.featured').find('#commentPreview').slideUp('slow');
                        });

                        $('.edit_gift_show').click(function() {
                            var text = $(this).parents('.featured').find('#edit_gift textarea').val();
                            var converter = new Showdown.converter();
                            var commentHtml = converter.makeHtml(text);

                            $(this).parents('.featured').find('.sgpPreview').html(commentHtml);

                            if (configGet('ge_be_livepreview') && text.length) {
                                $(this).parents('.featured').find('#commentPreview').slideDown('slow');
                            }
                        });
                    }
                }
                obj.find('#commentPreview').hide();
            }

            obj.find('.user_edit').find('.body_container:first').before('<div class="sgpBetterCommentEditor"></div>');
            obj.find('.user_edit').find('.comment_reply').append(' <span style="font-size: 12px; font-weight: normal; color: #4F565A;"><div class="sgpCheckbox' + checkedLivePreview + '" id="ge_be_livepreview"> Live Preview</div> <div class="sgpCheckbox' + checkedParseLineBreaks + '" id="ge_be_newlineparse"> Parse Line Breaks</div></span>');

            obj.find('.user_edit').each(function() {
                $(this).find('form').prepend('<div class="sgpBetterCommentEditor"></div>');
                if ($(this).parent().parent().is('.comment.parent')) {
                    $(this).after('<div class="comment child" id="commentPreview"><div class="child_container"><div style="color: #4F565A; font-size: 12px; text-shadow: 1px 1px #FFFFFF; word-wrap: break-word;"><span style="color: #347DB5;font-size: 12px;font-weight: bold;padding-bottom: 15px;">Live Preview</span><div class="body markdown sgpPreview"></div></div></div></div>');
                } else {
                    $(this).parents('.child_container:first').after('<div class="comment child" id="commentPreview"><div class="child_container"><div style="color: #4F565A; font-size: 12px; text-shadow: 1px 1px #FFFFFF; word-wrap: break-word;"><span style="color: #347DB5;font-size: 12px;font-weight: bold;padding-bottom: 15px;">Live Preview</span><div class="body markdown sgpPreview"></div></div></div></div>');
                }
            });

            //Better Comment Editor formating buttons.
            if (configGet('ge_be_formatbuttons')) {
                obj.find('.sgpBetterCommentEditor').append('<div class="body sgpMarkdown" style="font-size: 12px;"><a id="sgpBE_Bold" href="" style="margin-right: 8px; text-decoration: none;"><strong>Bold</strong></a><a id="sgpBE_Italic" href="" style="margin-right: 8px; text-decoration: none;"><i>Italic</i></a><a id="sgpBE_Link" href="" style="margin-right: 8px; text-decoration: none;">Link</a><a id="sgpBE_Code" href="" style="margin-right: 8px; text-decoration: none;"><code>Code</code></a><a id="sgpBE_BulletList" href="" style="margin-right: 8px; text-decoration: none;">&bull; Bullet List</a><a id="sgpBE_NumberList" href="" style="margin-right: 8px; text-decoration: none;">1. Numbered List</a>  <a id="sgpBE_HorizontalLine" href="" style="margin-right: 8px; text-decoration: none;">Horizontal Line</a> <select id="sgpBE_Heading" style="margin-right: 8px; padding: 1px; color: #4F565A; width: auto; "><option value="default" selected style="display: none;">Heading</option><option value="#">Heading 1</option><option value="##">Heading 2</option><option value="###">Heading 3</option><option value="####">Heading 4</option><option value="#####">Heading 5</option><option value="######">Heading 6</option></select><a href="http://www.steamgifts.com/forum/b7gwc/formatting-help-faq/" target="_blank" style="margin-right: 8px; color: #4F565A; text-decoration: none;">Formatting Help</a></div>');
            }

            obj.find('#commentPreview').hide();

            commentEditorFormatInit(obj);
            commentPreviewingInit(obj);
        }
    }

    /**
     * Loop through all comments and do our stuff to them. (Ignoring, user tagging, unread notifications, comment ids, etc.)
     * @param {Object} obj The object to do stuff with. Should be this page or an iframe's contents.
     * @param {boolean} endlessPage Whether we're doCommenting an endless scrolling page.
     */
    function doComments(obj, endlessPage) {
        //Variables.
        var topicCreator = '';
        if (page['section'] == 'giveaway') {
            topicCreator = $('.hosted_by').find('p>a:last').text();
        } else {
            topicCreator = $('.row.borderless p>a:last').text();
            var topicCommentCount = $('.row.borderless p>a:first').text().replace(/\D/g, '');
        }

        var storedTopic = lscache.get('topic_' + page['section'] + '_' + page['id']);
        if (storedTopic == null) {
            storedTopic = {};
        }

        var topicPageLatestCommentId = 0;
        var topicPageNewCommentLast = thisTopic['newCommentCount'];

        var commentLinkedToId = window.location.hash.substring(1);

        if (!storedTopic.hasOwnProperty('page')) {
            storedTopic['page'] = {};
        }
        if (!storedTopic['page'].hasOwnProperty(page['number'])) {
            storedTopic['page'][page['number']] = 0;
        }

        var latestCommentId = parseInt(storedTopic['page'][page['number']]);
        if (latestCommentId == null) {
            latestCommentId = 0;
        }

        var configCommentIds = configGet('ge_comments_ids');
        var configHighlightUnread = configGet('ge_highlightunread');
        var configHighlightOp = configGet('ge_comments_highlightop');

        //Topic comments
        var allComments = obj.find('.comment.parent, .comment.child');
        forEachChunked(allComments, page['maxItemsPerPage']['topic'] * 3, 250, function(commentObj, i, array) {
            var comment = $(commentObj);
            var commentId = parseInt(comment.attr('id'));
            var posterUsername = comment.find('.author_name>a:first').text();
            var commentTimestamp = comment.find('.author_date').text().match(/\s*(.*)\s*/)[1];

            comment.find('.author_name').css('display', 'inline-block');
            comment.find('.author_details').css('text-align', 'right');
            var commentAuthorDetails = $('<div class="sgpAuthorDetails"></div>').insertAfter(comment.find('.author_name'));

            //Mark OP.
            if (configHighlightOp && posterUsername == topicCreator) {
                commentAuthorDetails.append('<span title="Original Poster" style="color: #347DB5; font-weight: bold;"> (OP) </span>');
            }

            //Move additional tags on child comments to create space for usertags.
            if (usertags.hasOwnProperty(posterUsername) && comment.is('.comment.child')) {
                comment.find('.author_date').prepend(' ');
                comment.find('.author_name span').prependTo(comment.find('.author_date'));
            }

            //Usertags.
            comment.find('.author_name>a:first').after('<span class="spgUsertag"></span>');
            if (usertags.hasOwnProperty(posterUsername)) {
                comment.find('.spgUsertag').replaceWith(' <span class="spgUsertag" style="color: ' + usertags[posterUsername]['color'] + '; font-weight: bold;">' + usertags[posterUsername]['usertag'] + '</span>');
            }

            if (page['id'] != 'replies') {
                //Comment linking. (Child comments)
                if (configCommentIds) {
                    if (comment.is('.comment.child') && !comment.parent().is('form')) {
                        comment.find('.author_container').after('<a title="Comment Link" class="sgpCommentLink" style="float: left; font-size: 11px;" href="http://www.steamgifts.com/' + page['section'] + '/' + page['id'] + '/' + page['name'] + '/page/' + page['number'] + '#' + commentId + '">#' + commentId + '</a>');
                    }
                }

                //Unread comment highlighting
                if (configHighlightUnread) {
                    if (commentId != null && !isNaN(commentId) && ((commentId > latestCommentId && latestCommentId != 0) || (latestCommentId == 0 && storedTopic['comment_count'] != null))) {
                        if (comment.is('.comment.parent')) {
                            comment.children('.body_container').css({
                                "border": "1px solid #347DB5",
                                "border-radius": "4px 4px 4px 4px",
                                "padding": "5px 5px",
                                "width": "890px"
                            });
                        } else {
                            comment.children('.child_container').css("border", "1px solid #347DB5");
                        }

                        thisTopic['newCommentCount']++;

                        //New comment navigation.
                        comment.prepend('<div id="sgpNew' + thisTopic['newCommentCount'] + '"></div>');
                        if (comment.is('.comment.parent')) {
                            commentAuthorDetails.append('<a style="float: right; margin-left: 5px;" title="Next New Comment" class="sgpCommentGotoNext" name="sgpNew' + thisTopic['newCommentCount'] + '" href=""></a><a style="float: right; margin-left: 5px;" title="Previous New Comment" class="sgpCommentGotoPrev" name="sgpNew' + thisTopic['newCommentCount'] + '" href=""></a>');
                        } else {
                            comment.find('.author_container').after('<a style="float: left; margin-right: 5px;" title="Previous New Comment" class="sgpCommentGotoPrev" name="sgpNew' + thisTopic['newCommentCount'] + '" href=""></a><a style="float: left; margin-right: 5px;" title="Next New Comment" class="sgpCommentGotoNext" name="sgpNew' + thisTopic['newCommentCount'] + '" href=""></a>');
                        }
                    }
                    if (commentId > topicPageLatestCommentId) {
                        topicPageLatestCommentId = commentId;
                    }
                }

                //Comment linking. (Parent comments)
                if (configCommentIds) {
                    if (comment.is('.comment.parent')) {
                        commentAuthorDetails.append(' <a title="Comment Link" class="sgpCommentLink" href="http://www.steamgifts.com/' + page['section'] + '/' + page['id'] + '/' + page['name'] + '/page/' + page['number'] + '#' + commentId + '">#' + commentId + '</a>');
                    }
                }

                comment.find('.author_container').after('<br>');

                //Linked to comment highlighting.
                if (commentLinkedToId && commentId == commentLinkedToId) {
                    if (comment.is('.comment.parent')) {
                        comment.children('.body_container').addClass('sgpCommentLinkedTo');
                    } else {
                        comment.children('.child_container').addClass('sgpCommentLinkedTo');
                    }
                    comment.find('.sgpCommentLink').addClass('sgpCommentLinkSelected');

                    var offset = 20;
                    if (sgpFloatDownMenuOn) {
                        offset = 90;
                    }
                    $('html,body').animate({
                        scrollTop: comment.find('.sgpCommentLink').offset().top - offset
                    });
                }
            }

            //Feedback
            if (page['section'] == 'support' && inArray(posterUsername.toLowerCase(), staff) != -1) {
                comment.find('div.comment_reply:first').append(' <span class="sgpCommentFeedback"><a href="http://www.steamgifts.com/feedback?user=' + posterUsername + '" target="blank_">Give Feedback</a></span> ');
            }

            //User menu.
            commentAuthorDetails.append(' <div class="sgpDropdownMenuRelative"><div class="sgpDropdownMenuAbsolute"><a href=""><div class="sgpDropdownMenuHeading"></div></a><div class="sgpDropdownMenuItems" style="display: none;">\
          <div class="sgpDropdownMenuItem"><a id="sgpDropdownMenuUsertag" name="' + posterUsername + '" href=""><img src="' + image['usertag'] + '" style="width: 16px; margin-left: -4px; margin-right: -3px;"> Set Usertag</a></div>\
        </div></div></div>');

            //Ignored users.
            if (inArray(posterUsername.toLowerCase(), staff) == -1 && posterUsername != user['username']) {
                if (ignoredUsers.hasOwnProperty(posterUsername)) {
                    comment.find('.author_name>a:first').css('color', '#DD7070');
                    comment.find('.comment_body.markdown').hide();
                    comment.find('.avatar_container').hide();
                    comment.css('opacity', '0.6');

                    if (comment.is('.comment.parent')) {
                        comment.find('.body_container').css('width', '990px');
                        commentAuthorDetails.append(' <div style="color:#DD7070; font-weight:bold;">Comment by ignored user. <a class="sgpToggleIgnoredComment" href="">Show Comment</a></div>');
                    } else {
                        comment.find('.author_container').css('width', '310px');
                        comment.find('.user_body').prepend(' <div style="color:#DD7070; font-weight:bold;">Comment by ignored user. <a class="sgpToggleIgnoredComment" href="" style="color:#4F565A; font-weight:bold;">Show Comment</a></div>');
                    }

                    //User menu addition.
                    $('.sgpDropdownMenuItem:last').after('<div class="sgpDropdownMenuItem"><a id="sgpDropdownMenuUnignore" style="color:#DD7070;" name="' + posterUsername + '" href=""><img src="' + image['ignore'] + '" style="margin-left: -1px;"> Unignore User</a></div>');
                } else {
                    $('.sgpDropdownMenuItem:last').after('<div class="sgpDropdownMenuItem"><a id="sgpDropdownMenuIgnore" style="color:#DD7070;" name="' + posterUsername + '" href=""><img src="' + image['ignore'] + '" style="margin-left: -1px;"> Ignore User</a></div>');
                }
            }

            var commentLinkIdSafe = encodeURIComponent('http://www.steamgifts.com/' + page['section'] + '/' + page['id'] + '/' + page['name'] + '/page/' + page['number'] + '#' + commentId);
            if (user['loggedIn'] && posterUsername != user['username']) {
                var reportURL = 'http://www.steamgifts.com/support/new?type=report&user=' + posterUsername + '&url=' + commentLinkIdSafe;
                $('.sgpDropdownMenuItem:last').after('<div class="sgpDropdownMenuItem"><a id="sgpDropdownMenuLink" style="color:#FF8A00;" href="' + reportURL + '"><img src="http://www.steamgifts.com/img/bullet_error.png" style="margin-bottom: -4px; margin-right: -8px; margin-left: -3px;"> Report User</a></div>');
            }

            if (inArray(user['username'].toString().toLowerCase(), staff) != -1) {
                $('.sgpDropdownMenuItem:last').after('<div class="sgpDropdownMenuItem"><a id="sgpDropdownMenuLink" style="color:#4F565A;" href="http://www.steamgifts.com/moderator/lookup#' + posterUsername + '"><img src="' + image['lookup'] + '" style="width: 10px; margin-bottom: -2px;"> Lookup User</a></div>');
            }

            if (inArray(user['username'].toString().toLowerCase(), staff) != -1 && inArray(posterUsername.toLowerCase(), staff) == -1) {
                $('.sgpDropdownMenuItem:last').after('<div class="sgpDropdownMenuItem"><a id="sgpDropdownMenuLink" style="color:#DD7070;" href="http://www.steamgifts.com/user/' + posterUsername + '/suspensions/new?url=' + commentLinkIdSafe + '"><img src="http://www.steamgifts.com/img/verify_error.png" style="width: 12px; margin-bottom: -2px; margin-left: -2px; margin-right: -1px;"> Suspend User</a></div>');
            }

            if (i + 1 == array.length) {
                if (storedTopic['comment_count'] == null) {
                    storedTopic['comment_count'] = topicCommentCount;
                }

                if (page['id'] != 'replies') {
                    if (!endlessPage) {
                        //Topic creator usermenu.
                        $('.author>p>a:last').after(' <div class="sgpDropdownMenuRelative"><div class="sgpDropdownMenuAbsolute"><a href=""><div class="sgpDropdownMenuHeading"></div></a><div class="sgpDropdownMenuItems" style="display: none;">\
              <div class="sgpDropdownMenuItem"><a id="sgpDropdownMenuUsertag" name="' + topicCreator + '" href=""><img src="' + image['usertag'] + '" style="width: 16px; margin-left: -4px; margin-right: -3px;"> Set Usertag</a></div>\
                </div></div></div>');

                        if (inArray(topicCreator.toLowerCase(), staff) == -1 && topicCreator != user['username']) {
                            if (ignoredUsers.hasOwnProperty(topicCreator)) {
                                $('.author>p .sgpDropdownMenuItem:last').after('<div class="sgpDropdownMenuItem"><a id="sgpDropdownMenuUnignore" style="color:#DD7070;" name="' + topicCreator + '" href=""><img src="' + image['ignore'] + '" style="margin-left: -1px;"> Unignore User</a></div>');
                            } else {
                                $('.author>p .sgpDropdownMenuItem:last').after('<div class="sgpDropdownMenuItem"><a id="sgpDropdownMenuIgnore" style="color:#DD7070;" name="' + topicCreator + '" href=""><img src="' + image['ignore'] + '" style="margin-left: -1px;"> Ignore User</a></div>');
                            }
                        }

                        if (user['loggedIn'] && topicCreator != user['username']) {
                            var reportURL = 'http://www.steamgifts.com/support/new?type=report&user=' + topicCreator + '&url=' + encodeURIComponent('http://www.steamgifts.com/' + page['section'] + '/' + page['id'] + '/' + page['name']);
                            $('.author>p .sgpDropdownMenuItem:last').after('<div class="sgpDropdownMenuItem"><a id="sgpDropdownMenuLink" style="color:#FF8A00;" href="' + reportURL + '"><img src="http://www.steamgifts.com/img/bullet_error.png" style="margin-bottom: -4px; margin-right: -8px; margin-left: -3px;"> Report User</a></div>');
                        }

                        if (inArray(user['username'].toString().toLowerCase(), staff) != -1) {
                            $('.author>p .sgpDropdownMenuItem:last').after('<div class="sgpDropdownMenuItem"><a id="sgpDropdownMenuLink" style="color:#4F565A;" href="http://www.steamgifts.com/moderator/lookup#' + topicCreator + '"><img src="' + image['lookup'] + '" style="width: 10px; margin-bottom: -2px;"> Lookup User</a></div>');
                        }

                        if (inArray(user['username'].toString().toLowerCase(), staff) != -1 && inArray(topicCreator.toLowerCase(), staff) == -1) {
                            $('.author>p .sgpDropdownMenuItem:last').after('<div class="sgpDropdownMenuItem"><a id="sgpDropdownMenuLink" style="color:#DD7070;" href="http://www.steamgifts.com/user/' + topicCreator + '/suspensions/new?url=' + encodeURIComponent('http://www.steamgifts.com/' + page['section'] + '/' + page['id'] + '/' + page['name']) + '"><img src="http://www.steamgifts.com/img/verify_error.png" style="width: 12px; margin-bottom: -2px; margin-left: -2px; margin-right: -1px;"> Suspend User</a></div>');
                        }

                        //Topic creator usertag.
                        if (usertags.hasOwnProperty(topicCreator)) {
                            obj.find('.author>p>a:last').after(' <span style="color:' + usertags[topicCreator]['color'] + '; font-weight:bold;">' + usertags[topicCreator]['usertag'] + '</span>');
                        }
                    }
                    //New comment notifcations.
                    if (configHighlightUnread) {
                        if (endlessPage) {
                            $('.sgpRowPage').eq(-2).append('<center><a class="sgpCommentGotoNextNotifcation" title="' + (thisTopic['newCommentCount'] - topicPageNewCommentLast) + ' New comments since you last viewed this page." name="sgpNew' + topicPageNewCommentLast + '" href="">' + (thisTopic['newCommentCount'] - topicPageNewCommentLast) + ' New</a></center>');
                            if ((thisTopic['newCommentCount'] - parseInt(topicPageNewCommentLast)) == 0) {
                                $('.sgpCommentGotoNextNotifcation:last').css('color', '#BBBBBB');
                            }
                        } else {
                            obj.find('.sub_navigation li:first').after('<li class="selected"><a class="sgpCommentGotoNextNotifcation" title="' + thisTopic['newCommentCount'] + ' New comments since you last viewed this page." name="sgpNew0" href="">' + thisTopic['newCommentCount'] + ' New</a></li>');
                            if (thisTopic['newCommentCount'] == 0) {
                                $('.sgpCommentGotoNextNotifcation:last').css('color', '#BBBBBB');
                            }
                        }
                        if (page['section'] == 'forum' && locationURI.length > 4) {
                            if (!storedTopic.hasOwnProperty('comment_count') || storedTopic['comment_count'] == null || storedTopic['comment_count'] > topicCommentCount) {
                                storedTopic['comment_count'] = topicCommentCount;
                            } else {
                                var maxComments = topicCommentCount;
                                var newCommentCount = parseInt(storedTopic['comment_count']) + (parseInt(thisTopic['newCommentCount']) - topicPageNewCommentLast);
                                if (newCommentCount > maxComments) {
                                    newCommentCount = maxComments
                                }
                                storedTopic['comment_count'] = newCommentCount;
                            }
                        }
                    }
                    storedTopic['page'][page['number']] = topicPageLatestCommentId;

                    lscache.set('topic_' + page['section'] + '_' + page['id'], storedTopic, configGet('a_unreadcommentexpire_value') * 10080);
                }
            }
        });

        //Alternate child comment background colours.
        forEachChunked(obj.find('.border_container'), page['maxItemsPerPage']['topic'] * 3, 500, function(containerObj, i, array) {
            var container = $(containerObj);
            if (container.parent().css('background-color') == 'rgb(235, 235, 235)') {
                container.css({
                    'border-left': '1px solid #DDDDDD',
                    'background-color': '#F4F4F4'
                });
            } else {
                container.css({
                    'border-left': '1px solid #BFBFBF',
                    'background-color': '#EBEBEB'
                });
            }
        });

        //Hover images.
        if (configGet('ge_comments_imagehover')) {
            forEachChunked(obj.find('.comment_body.markdown a, .body.markdown a'), page['maxItemsPerPage']['topic'] * 3, 250, function(commentObj, i, array) {
                var comment = $(commentObj);
                if (comment.attr('href').match(/\.(jpg|jpeg|gif|png|bmp)/i) && comment.text().trim().length) {
                    comment.append(' <img src="' + image['imageHover'] + '">');
                }
            });
        }
    }

    /**
     * SteamGifts Plus - Forums
     * @param {Object} obj The object to do stuff with. Should be this page or an iframe's contents.
     */
    function doForum(obj) {
        var configHighlightStaffTopics = configGet('f_highlightstafftopics');
        var configNewestFirst = configGet('f_newestfirst');
        var configMarkReplied = configGet('f_markreplied');
        var configHighlightNew = configGet('ge_highlightunread');

        var allTopics = obj.find('.row');
        forEachChunked(allTopics, page['maxItemsPerPage']['forum'] / 5, 500, function(forumObj, i, array) {
            //Topic variables.
            var topic = $(forumObj);
            var topicURL = topic.find('.title>a').attr('href');
            var topicId = topicURL.substring(7, 12);
            var topicCreator = topic.find('.author a:last').text();
            var topicLastReply = topic.find('.reply a:last').text();
            var topicCommentCount = topic.find('.author a:first').text().replace(/\D/g, '');

            //Newest first.
            if (configNewestFirst) {
                topicURL = topicURL + '/page/31337';
                topic.find('.title>a').attr('href', topicURL);
                topic.find('.author>p>a:first').attr('href', topicURL);
            }

            //Highlight Staff topics.
            if (configHighlightStaffTopics && inArray(topicCreator.toLowerCase(), staff) != -1) {
                //Insert it after (Sticky) tags.
                if (topic.find('.title>span').length) {
                    topic.find('.title>span').after('<span style="color:#347DB5;"> (Staff)</span> ');
                } else {
                    topic.find('.title').prepend('<span style="color:#347DB5;">(Staff)</span> ');
                }
            }

            //Usertags.
            if (usertags.hasOwnProperty(topicCreator)) {
                topic.find('.author>p>a:last').after(' <span style="color:' + usertags[topicCreator]['color'] + '; font-weight:bold;">' + usertags[topicCreator]['usertag'] + '</span>');
            }
            if (usertags.hasOwnProperty(topicLastReply)) {
                topic.find('.reply>p>a:last').after(' <span style="color:' + usertags[topicLastReply]['color'] + '; font-weight:bold;">' + usertags[topicLastReply]['usertag'] + '</span>');
            }

            var storedTopic = lscache.get('topic_' + page['section'] + '_' + topicId);
            if (storedTopic == null) {
                storedTopic = {};
            }
            if (storedTopic['comment_count'] == null) {
                storedTopic['comment_count'] = topicCommentCount;
            }

            //Mark replied to topics.
            if (configMarkReplied && storedTopic.hasOwnProperty('repliedTo')) {
                topic.find('.title').append(' <span title="You have previously replied to this topic." style="font-size:18px; font-weight: bold; color:#347DB5; line-height: 10px;">*</span>');
                topic.css('background-color', '#F9F9F9');
            }

            //New comment notifaction.
            if (configHighlightNew) {
                if (storedTopic.hasOwnProperty('comment_count') && storedTopic['comment_count'] > 0) {
                    if (topicCommentCount > storedTopic['comment_count']) {
                        var topicCommentNewCount = topicCommentCount - storedTopic['comment_count'];
                        topic.find('.author a:first').after(' <a href="" title="Mark topic as read." class="sgpTopicMarkAsRead" name="' + topicId + '" style="color:#DD7070;"><strong>' + topicCommentNewCount + '</strong> New</a>');
                    } else if (storedTopic['comment_count'] > topicCommentCount) {
                        storedTopic['comment_count'] = topicCommentCount;
                        lscache.set('topic_' + page['section'] + '_' + topicId, storedTopic);
                    }
                }
            }

            //Ignored user topics.
            if (inArray(topicCreator.toLowerCase(), staff) == -1 && topicCreator != user['username']) {
                if (ignoredUsers.hasOwnProperty(topicCreator)) {
                    topic.css('opacity', '0.4');
                    topic.find('.title').css('font-size', '11px');
                    topic.find('.details').css('width', '100%');
                    topic.find('.title').prepend('<span style="color: #DD7070">Ignored topic by <a style="color: #347DB5;"href="http://www.steamgifts.com/user/' + topicCreator + '">' + topicCreator + '</a>: </span>');
                    topic.find('.title').append(' <a style="font-weight: normal; color: #347DB5;" href="' + topicURL + '">' + topicCommentCount + ' Comments</a>');
                    topic.find('.title').append('<span style="float: right; font-weight: normal;">' + topic.find('.reply p:first').text() + ' <a href="http://www.steamgifts.com/user/' + topic.find('.reply p:last').text() + '">' + topic.find('.reply p:last').text() + '</a>');
                    topic.find('.author, .author_avatar, .reply, .reply_avatar').hide();
                }
            }
        });

        //Closed sticky opacity fix.
        obj.find('span:contains("(Sticky)")').parents('.row').css({
            'opacity': '1.0',
            'background-color': '#EDEDEF',
            'border-left': '1px solid #E4E4E4',
            'border-right': '1px solid #E4E4E4'
        });
        obj.find('span:contains("(Sticky)"):last').parents('.row').after('<div class="sgpRowPage" style="padding: 5px; background: #F9F9FB;"></div>');

        //Row spacing.
        obj.find('.row').css('padding', configGet('ge_rowpadding') + 'px 0');
    }

    function doFeedback() {
        if (getURLParameter('user') != null) {
            var username = getURLParameter('user');
            $('.username:not(:contains(' + username + '))').parents('.mod_container').hide();
        }
    }

    /**
     * SteamGifts Plus - Support
     */
    function doSupport() {
        // User reports form.
        if (page['id'] == 'new' && getURLParameter('type') == 'report' && getURLParameter('user') != null) {
            $('title').text('New User Report');

            var username = getURLParameter('user');
            $('.wrapper>.content').prepend('<div class="create_giveaway" id="sgpUserReport">\
          <div class="icon support_title_icon"></div>\
          <div class="input">\
            <label for="category_id">Select a reason to report ' + username + '</label>\
            <select name="category_id">\
              <option></option>\
              <option>Advertising</option>\
              <option>Alternate Accounts</option>\
              <option>Begging</option>\
              <option>Exploited Key Giveaways</option>\
              <option>Fake Giveaways</option>\
              <option>Feedback Fraud</option>\
              <option>Gifting Beta Keys or Guest Passes</option>\
              <option>Inappropriate Behavior</option>\
              <option>Misleading Giveaway</option>\
              <option>Non-Steam Redeemable Giveaway</option>\
              <option>Multiple Wins for the Same Game.</option>\
              <option>Referral Links</option>\
              <option>Regifting</option>\
              <option>Spam</option>\
              <option>Trading or Not Activating Won Gift</option>\
              <option>Other</option>\
            </select>\
            <div class="clear_both"></div>\
                        </div>\
          <div class="clear_both"></div>\
          <div class="divider" style="margin:12px 0;"></div>\
          <div class="icon support_category_icon"></div>\
          <div class="input">\
            <label for="url">URL (optional)</label>\
            <input style="width:100%;" name="url" type="text" value="" />\
            <div class="clear_both"></div>\
            <div class="date_description">Enter an optional URL related to the report.</div>\
            <div class="clear_both"></div>\
                        </div>\
          <div class="clear_both"></div>\
          <div class="divider" style="margin:12px 0;"></div>\
          <div class="icon support_description_icon"></div>\
          <div class="input">\
            <label for="notes">Notes (optional)</label>\
            <textarea style="width:100%;" name="notes" id="notes" cols="45" rows="15"></textarea>\
            <div class="clear_both"></div>\
            <div class="date_description">If necessary, please add additional notes to better explain the report.</div>\
            <div class="clear_both"></div>\
                        </div>\
          <div class="clear_both"></div>\
          <div class="divider" style="margin:12px 0;"></div>\
          <div>\
            <div class="input">\
              <a href="" class="spgSubmitReport">Report User</a>\
            </div>\
            <div class="clear_both"></div>\
          </div>\
        </div>');

            var reportURL = getURLParameter('url');
            if (reportURL != null) {
                $('#sgpUserReport input[name="url"]').val(reportURL);
            }

            $('.create_giveaway:last').hide();
            $('.create_giveaway:last input[name="title"]').val('[User Report] ' + username);
            $('.create_giveaway:last select[name="category_id"]').val('11');
        }
    }

    /**
     * SteamGifts Plus - User Sync
     */
    function doSync() {
        updateWishlist(true);
        updateLibrary(true);
    }

    /**
     * Do giveaway page stuff.
     * @param {Object} obj The giveaway object.
     */
    function doGiveaway(obj) {
        var giveawayTitle = obj.find('.title:first').text();
        var giveawayCopies = giveawayTitle.match(/\(([0-9]*(,[0-9]*)?)\s*Copies\)/g);
        if (giveawayCopies) {
            giveawayCopies = parseInt(giveawayCopies.toString().replace(/([^0-9*])/g, ''));
        } else {
            giveawayCopies = 1;
        }
        var giveawayEntries = parseInt(obj.find('.rounded.entries').text().trim().replace(/([^0-9]*)/g, ''));

        var giveawayCreator = obj.find('.hosted_by p>a:last').text();

        var isCreator = false
        if (user['username'] == giveawayCreator) {
            isCreator = true;
        }

        var giveawayEntered = false;
        if (obj.find('.rounded.entered.remove_entry').length) {
            giveawayEntered = true;
        }

        var giveawayEnded = true;
        if (obj.find('.time_remaining:contains(Open)').length) {
            giveawayEnded = false;
        }

        //Win chance
        if (configGet('gi_showwinchance') && !obj.find('.time_remaining:contains(begins)').length) {
            var winChance = Math.round((1 / ((giveawayEntries ? (giveawayEntries + (giveawayEnded ? 0 : (isCreator ? 0 : (giveawayEntered ? 0 : 1)))) : 1) / giveawayCopies) * 100) * 100) / 100;

            if (winChance < 0.001) {
                winChance = 0.001;
            } else if (winChance > 100) {
                winChance = 100;
            }
            obj.find('.time_remaining').append('<span style="margin-left: 40px; font-weight:bold;">' + winChance + '%</span> chance to win')
        }
    }

    /**
     * Filters all giveaways.
     * @param {Object} obj The giveaways to filter.
     */
    function filterGiveaways(obj) {
        giveawayFilteringDone = false;

        var filterShowPublic = configGet('gi_f_showpublic');
        var filterShowGroup = configGet('gi_f_showgroup');
        var filterShowEntered = configGet('gi_f_showentered');
        var filterLimitByPoints = configGet('gi_f_limitpoints');
        var filterShowWishlistOnly = configGet('gi_f_wishlistonly');
        var filterHideDLC = configGet('gi_f_dlc');
        var filterEntryLimitOnly = configGet('gi_f_entrylimit_enabled');
        var filterEntryLimitPerCopy = configGet('gi_f_entrylimit_percopy');
        var filterEntryLimitValue = configGet('gi_f_entrylimit_value');
        var filterEntryMinimumCopies = configGet('gi_f_minimumcopies');
        var filterMinimumChance = parseFloat(configGet('gi_f_minimumchance'));
        var filterLimitByContributorGreen = configGet('gi_f_contributor_green');
        var filterLimitByContributorRed = configGet('gi_f_contributor_red');
        var filterLimitByContributorValueMin = parseFloat(configGet('gi_f_contributor_value_min'));
        var filterLimitByContributorValueMax = parseFloat(configGet('gi_f_contributor_value_max'));
        var filterCustomGames = configGet('gi_f_enabled');
        var filterLibraryGames = configGet('gi_f_library_enabled');

        var wishlist = lscache.get('giveawayWishlist');
        if (wishlist == null) {
            wishlist = {};
        }

        var DLCList = lscache.get('DLC');
        if (DLCList == null) {
            DLCList = {};
        }

        var giveawayLibraryFilters = giveawayFilters['libraryFilters'];
        if (giveawayLibraryFilters == null) {
            giveawayLibraryFilters = {};
        }

        for (var game in giveawayLibraryFilters) {
            var safeGameName = game.toLowerCase().replace(/\W/g, "");
            if (game != safeGameName) {
                giveawayLibraryFilters[safeGameName] = giveawayLibraryFilters[game];
                delete giveawayLibraryFilters[game];
            }
        }

        var DLCFilterList = {};

        for (var game in DLCList) {
            if (!giveawayLibraryFilters.hasOwnProperty(game)) {
                var listLength = DLCList[game].length;
                for (var i = 0; i < listLength; i++) {
                    DLCFilterList[DLCList[game][i]] = true;
                }
            }
        }

        var giveaways = obj.find('.ajax_gifts .title');

        forEachChunked(giveaways, page['maxItemsPerPage']['giveaway'] / 5, 100, function(giveawayObj, i, array) {
            var giveaway = $(giveawayObj).parent().parent();
            var giveawayName = giveaway.find('.title>a').text();
            var giveawaySafeName = (giveaway.find('.title>a').attr('href').match(/\/giveaway\/.{5}\/(.*)/)[1]).toLowerCase().replace(/\W/g, '');
            var giveawayPoints = parseInt(giveaway.find('.title>span:last').text().replace(/([^0-9]*)/g, ''));
            var giveawayEntries = parseInt(giveaway.find('.entries>span:first').text().trim().replace(/([^0-9]*)/g, ''));
            var giveawayGroupOnly = giveaway.find('.group_only').length;
            var giveawayContributorValue = -1;
            if (giveaway.find('.contributor_only').length) {
                giveawayContributorValue = parseFloat(giveaway.find('.contributor_only').text().trim().replace(/([^0-9.]*)/g, ''));
            }
            var giveawayCopies = giveaway.find('.title').text().match(/\(([0-9]*(,[0-9]*)?)\s*Copies\)/g);

            if (giveawayCopies) {
                giveawayCopies = parseInt(giveawayCopies.toString().replace(/([^0-9*])/g, ''));
            } else {
                giveawayCopies = 1;
            }

            var giveawayCreator = giveaway.find('.created_by>a').text();

            var isCreator = user['username'] == giveawayCreator;

            var giveawayEntered = giveaway.hasClass('fade');

            var giveawayEnded = giveaway.find('.time_remaining:contains(Ended)').length || giveaway.find('.time_remaining:contains(Awaiting)').length;

            var winChance = Math.round((1 / ((giveawayEntries ? (giveawayEntries + (giveawayEnded ? 0 : (isCreator ? 0 : (giveawayEntered ? 0 : 1)))) : 1) / giveawayCopies) * 100) * 100) / 100;

            if (winChance < 0.001) {
                winChance = 0.001;
            } else if (winChance > 100) {
                winChance = 100;
            }

            var hide = false;
            var show = false;

            var lowercaseGiveawayName = giveawayName.toLowerCase();
            var trimmedGiveawayName = lowercaseGiveawayName.trim();
            var reducedGiveawayName = lowercaseGiveawayName.replace(/\W/g, '');

            if (!filterShowGroup && giveawayGroupOnly) {
                hide = true;
            } else if (filterShowGroup && giveawayGroupOnly) {
                show = true;
            }

            if (filterLimitByContributorGreen && giveaway.find('.contributor_only.green').length) {
                show = true;
            } else if (giveaway.find('.contributor_only.green').length) {
                hide = true;
            }

            if (filterLimitByContributorRed && giveaway.find('.contributor_only:not(.green)').length) {
                show = true;
            } else if (giveaway.find('.contributor_only:not(.green)').length) {
                hide = true;
            }

            if (!filterShowPublic && !giveawayGroupOnly && !giveaway.find('.contributor_only.green').length && !giveaway.find('.contributor_only:not(.green)').length) {
                hide = true;
                show = false;
            }

            if (!filterLimitByContributorRed && giveaway.find('.contributor_only') && giveaway.find('.contributor_only:not(.green)').length) {
                show = false;
                hide = true;
            }

            if (giveaway.find('.contributor_only').length && (giveawayContributorValue < filterLimitByContributorValueMin || giveawayContributorValue > filterLimitByContributorValueMax)) {
                hide = true;
                show = false;
            }

            if (filterCustomGames) {
                for (var key in giveawayFilters) {
                    if (!giveawayFilters[key]) {
                        key = key.trim();
                        var filterRegex = new RegExp('^' + key.toLowerCase().replace(/[\_\-\[\]{}()+?.,\\^$|#\s]/g, '\\$&').replace(/\*/g, '.*') + '$');

                        if (trimmedGiveawayName.match(filterRegex)) {
                            hide = true;
                            show = false;
                        }
                    }
                }
            }

            if (filterLibraryGames) {
                if (giveawayLibraryFilters.hasOwnProperty(giveawaySafeName) && giveawayLibraryFilters[giveawaySafeName]) {
                    hide = true;
                    show = false;
                }
            }

            if (filterHideDLC && DLCFilterList.hasOwnProperty(giveawaySafeName)) {
                hide = true;
                show = false;
            }

            //Additional filtering. 
            if (filterEntryLimitOnly && giveawayEntries > (filterEntryLimitValue * (filterEntryLimitPerCopy ? giveawayCopies : 1))) {
                hide = true;
                show = false;
            }

            if (!filterShowEntered && giveaway.hasClass('fade')) {
                hide = true;
                show = false;
            }

            if (filterLimitByPoints && giveawayPoints > user['points']) {
                hide = true;
                show = false;
            }

            if (giveawayCopies < filterEntryMinimumCopies) {
                hide = true;
                show = false;
            }

            if (winChance < filterMinimumChance) {
                hide = true;
                show = false;
            }

            if (filterShowWishlistOnly && !wishlist.hasOwnProperty(giveawayName)) {
                hide = true;
                show = false;
            }

            //Giveaway search
            if (giveawaySearch != '') {
                var searchRegex = new RegExp('^.*' + giveawaySearch.toLowerCase() + '.*$');
                if (!giveawayName.toLowerCase().match(searchRegex)) {
                    hide = true;
                    show = false;
                }
            }

            if (hide && !show) {
                giveaway.hide();
            } else {
                giveaway.show();
                if (configGet('gi_gridview') && page['id'] != 'search') {
                    giveaway.css('display', 'inline-block');
                }
            }

            if (i + 1 == array.length) {
                giveawayFilteringDone = true;
                endlessScrollingCheck();
            }
        });

        var hide = true;

        $('.post[style*="227, 236, 245"], .post[style*="#E3ECF5"]').show();
        if ($('.post[style*="227, 236, 245"] div, .post[style*="#E3ECF5"] div').is(':visible')) {
            $('.post[style*="227, 236, 245"], .post[style*="#E3ECF5"]').show();
            hide = false;
        } else {
            $('.post[style*="227, 236, 245"], .post[style*="#E3ECF5"]').hide()
        }
    }

    /**
     * Filter controls on the home page.
     */
    function doFilterControls() {
        $('.content>.post').css('margin-top', '15px').insertAfter('.sgpRowPage:first');
        $('.sgpRowPage:first').insertAfter('.pagination:first');

        $('body').append('<div id="sgpFilterControlsClose"></div>');

        $('.sub_navigation .relative_dropdown:first').after('<div class="sgpDropdownFilterControlsRelative">\
      <div class="sgpDropdownFilterControlsAbsolute">\
      <div class="sgpDropdownFilterControlsHeading">\
      <a href="">Filter Settings</a>\
      </div><div class="sgpDropdownFilterControlsItems" style="display: none;">\
      <div class="sgpFilterControls"><div class="sgpCheckbox" id="gi_f_showpublic"> Show All Public</div> <div class="sgpCheckbox" id="gi_f_showgroup"> Show Group</div> <div class="sgpCheckbox" id="gi_f_showentered"> Show Entered</div> <div class="sgpCheckbox" id="gi_f_contributor_green"> Show Green</div> <div class="sgpCheckbox" id="gi_f_contributor_red"> Show Red</div> <a class="button" id="sgpGameFilterPopupButton" href="" style="margin-top: -5px; float: right;">Game Filters</a> \
      <div class="clear_both"></div><div class="sgpCheckbox" style="margin-bottom: 7px;" id="gi_f_limitpoints"> Limit by Points (P) Available</div> <div class="sgpCheckbox" id="gi_f_wishlistonly"> Show Wishlist Only</div> <div class="sgpCheckbox" id="gi_f_dlc"> Hide DLC for games I don\'t own</div>\
      <div class="clear_both"></div><div class="sgpCheckbox" id="gi_f_entrylimit_enabled"> Entry Limit</div> (<div class="sgpCheckbox" id="gi_f_entrylimit_percopy"> Per Copy</div>) <input class="sgpFilterInput" id="gi_f_entrylimit_value" type="text" size="5" value="0" maxlength="5" style="margin-top:0;"> Minimum Copies: <input class="sgpFilterInput" id="gi_f_minimumcopies" type="text" size="5" value="0" maxlength="5" style="margin-top:0;"> Minimum Win Chance: <input class="sgpFilterInput" id="gi_f_minimumchance" type="text" size="5" value="0" maxlength="5" style="margin-top:0;">%\
      <div class="clear_both"></div>\
      <div class="clear_both"></div>$ <input class="sgpFilterInput" id="gi_f_contributor_value_min" type="text" size="7" value="0" maxlength="7" style="margin-top:0;"> <div style="margin-top: 5px; margin-left: 5px; margin-right: 5px; width: 460px; display: inline-block;" id="sgpContributorValueRangeSlider"></div> $ <input class="sgpFilterInput"id="gi_f_contributor_value_max" type="text" size="7" value="0" maxlength="7" style="margin-top:0;"></div>\
      </div></div></div>');

        $('.sub_navigation .relative_dropdown, .sub_navigation .sgpDropdownFilterControlsRelative').appendTo('#sgpGiveawayDropdowns');

        filterControlsInit();
    }

    /**
     * Initializ filter controls.
     */
    function filterControlsInit() {
        //Contributor slider.
        $('#sgpContributorValueRangeSlider').slider({
            range: true,
            min: 0.00,
            max: 5000.00,
            step: 1.00,
            values: [configGet('gi_f_contributor_value_min'), configGet('gi_f_contributor_value_max')],
            slide: function(event, ui) {
                $('#gi_f_contributor_value_min').val(parseFloat(ui.values[0]).toFixed(2));
                $('#gi_f_contributor_value_max').val(parseFloat(ui.values[1]).toFixed(2));
            },
            stop: function(event, ui) {
                configSet('gi_f_contributor_value_min', parseFloat(ui.values[0]).toFixed(2));
                configSet('gi_f_contributor_value_max', parseFloat(ui.values[1]).toFixed(2));
                filterGiveaways($('body'));
            },
            create: function(event, ui) {
                $('#gi_f_contributor_value_min').val(configGet('gi_f_contributor_value_min'));
                $('#gi_f_contributor_value_max').val(configGet('gi_f_contributor_value_max'));
            }
        });

        //Load checkboxes.
        $('.sgpCheckbox').each(function() {
            var key = $(this).attr('id');
            var value = configGet(key);

            if (value) {
                $('.sgpCheckbox#' + key).addClass('checked');
            } else {
                $('.sgpCheckbox#' + key).removeClass('checked');
            }

            switch (key) {
                case 'f_endlessscrolling':
                    if (!value) {
                        $('#f_endlessscrolling_seamless').addClass('disabled');
                    }
                    break;
                case 'gi_endlessscrolling':
                    if (!value) {
                        $('#gi_endlessscrolling_seamless').addClass('disabled');
                    }
                    break;
                case 'gi_f_entrylimit_enabled':
                    if (!value) {
                        $('#gi_f_entrylimit_value').attr('disabled', true);
                    }
                    break;
                case 'gi_hidefeatured':
                    if (!value) {
                        $('#gi_replacefeatured').addClass('disabled');
                    }
                    break;
                case 'ge_be_bettereditor':
                    if (!value) {
                        $('#ge_be_livepreview, #ge_be_formatbuttons, #ge_be_newlineparse').addClass('disabled');
                    }
                    break;
            }
        });

        //Load text inputs.
        $('#gi_f_entrylimit_value, #gi_f_minimumcopies, #gi_f_minimumchance').each(function() {
            var key = $(this).attr('id');
            $(this).val(configGet(key));
        });
    }

    /**
     * Called by iframe onload for giveaway quickview.
     * @param {Object} obj The iframe object.
     */
    unsafeWindow.sgpQuickviewLoaded = function(obj) {
        $('#sgpQuickviewLoading').remove();
        $('.sgpOverlay#sgpQuickview').css({
            'width': '800px',
            'height': '500px',
            'margin-left': '-400px',
            'margin-top': '-250px',
            'z-index': '100'
        });
        $('iframe#sgpQuickView').css({
            'width': '100%',
            'height': '100%',
            'position': 'static',
            'top': '0'
        });

        var obj = $(obj).contents();

        //Comment and Enter button.
        var commentForm = $('iframe#sgpQuickView').contents().find('#comment_form');

        $('<input type="submit" value="Comment and Enter">').appendTo(commentForm.find('.comment_reply')).click(function() {
            $.post($('iframe#sgpQuickView').attr('src'), $('iframe#sgpQuickView').contents().find('#form_enter_giveaway').serialize(), function(data) {
                commentForm.find('form').append('<input type="hidden" name="submit_comment" value="1">').submit();
            });
            return false;
        });
        commentForm.find('.comment_reply input:first').attr('value', 'Submit');

        //Do our stuff to the page.
        doGiveaway(obj);
        styleInit(obj);
        //doComments(obj, false);
        doBetterCommentEditor(obj, false);

        //Update homepage.
        if (obj.find('#form_enter_giveaway a.entered').length) {
            $('.ajax_gifts>div.post.quickview').addClass('fade');
        } else {
            $('.ajax_gifts>div.post.quickview').removeClass('fade');
        }

        //Update points.
        if (user['loggedIn']) {
            var tempOldPoints = user['points'];
            user['points'] = parseInt($(obj).find('a:contains(Account)', '#navigation').text().trim().replace(/([^0-9]*)/g, ''));
            $('a:contains(Account)', '#navigation, #sgpMenuWrapper').text('Account (' + user["points"] + 'P)');

            if (user['points'] != tempOldPoints) {
                filterGiveaways($('body'));
            }
        }

        //Redesign page to fit within the quickview overlay.
        obj.find('.discussions:last, .footer_sm, .footer_sales, .footer, .featured .left, .bg_gradient .content:first, .content_divider:last').remove();
        obj.find('.content').css('width', '100%');
        obj.find('.content:first').css('width', '97%');
        obj.find('.bg_gradient').css('background-position', 'center center');
        obj.find('.body_container').css('width:', '700px');
        obj.find('.parent_container').css('padding', '0').find('.comment.parent').css('padding', '5px');
        obj.find('.featured').css('padding', '0').find('.right').css('padding-top', '5px');
        obj.find('.featured').find('.right').css({
            'float': 'left',
            'width': '100%'
        });
        obj.find('.bg_gradient.shadow').css('background-image', 'none');
        obj.find('body').css({
            'min-width': '0',
            'width': '100%'
        });
        obj.find('#comment_form').prependTo(obj.find('.wrapper').css('padding', '0')).find('.body_container').attr('style', '');
        obj.find('#comment_location').insertBefore(obj.find('#comment_form'));
        obj.find('.comment.parent .body_container').css('width', '690px');
        obj.find('.border_container').css('max-width', '679px');
    }

    /**
     * SteamGifts Plus - Home Index
     * @param {Object} obj The object to do stuff with. Should be this page or an iframe's contents.
     * @param {boolean} endlessPage True if we're doing an endless page.
     */
    function doHome(obj, endlessPage) {
        var wishlist = lscache.get('giveawayWishlist');
        if (wishlist == null) {
            wishlist = {};
        }

        forEachChunked(obj.find('.ajax_gifts .post, .content>.post>div'), page['maxItemsPerPage']['giveaway'] / 5, 100, function(obj, i, array) {
            var giveaway = $(obj);
            var giveawayTitle = giveaway.find('.title').text();
            var giveawayURL = giveaway.find('.title>a').attr('href');

            var giveawayCopies = giveawayTitle.match(/\(([0-9]*(,[0-9]*)?)\s*Copies\)/g);
            if (giveawayCopies) {
                giveawayCopies = parseInt(giveawayCopies.toString().replace(/([^0-9*])/g, ''));
            } else {
                giveawayCopies = 1;
            }
            var giveawayEntries = parseInt(giveaway.find('.entries>span:first').text().trim().replace(/([^0-9]*)/g, ''));


            var giveawayCreator = giveaway.find('.created_by>a').text();

            var isCreator = false
            if (user['username'] == giveawayCreator) {
                isCreator = true;
            }

            var giveawayEntered = false;
            if (giveaway.hasClass('fade')) {
                giveawayEntered = true;
            }

            var giveawayEnded = false;
            if (giveaway.find('.time_remaining:contains(Ended)').length || giveaway.find('.time_remaining:contains(Awaiting)').length) {
                giveawayEnded = true;
            }

            //Win chance
            var winChance = Math.round((1 / ((giveawayEntries ? (giveawayEntries + (giveawayEnded ? 0 : (isCreator ? 0 : (giveawayEntered ? 0 : 1)))) : 1) / giveawayCopies) * 100) * 100) / 100;

            if (winChance < 0.001) {
                winChance = 0.001;
            } else if (winChance > 100) {
                winChance = 100;
            }

            if (configGet('gi_showwinchance') && !giveaway.find('.time_remaining:contains(begins)').length) {
                giveaway.find('.time_remaining span:first').before('<span style="margin-left:5px; color:#7D888F;"><strong>' + winChance + '%</strong> chance to win</span>')
            }

            var giveawayLogo = giveaway.find('.right');
            giveawayLogo.find('img').css({
                'float': 'right',
                'position': 'relative',
                'z-index': '2'
            });

            //Quick View
            if (configGet('gi_quickview')) {
                giveawayLogo.append('<a href="' + giveawayURL + '"><div class="sgpQuickviewButton">Quick View</div></a>');
            }

            //Add 'Add to Filter' button.   
            var giveawayName = giveaway.find('.title>a').text();
            giveaway.find('.entries').append('<span style="margin-right:10px;"><a id="sgpAddToFilter" href="">Add to Filter</a></span>');

            //Ignored user giveaways.
            var giveawayCreator = giveaway.find('.created_by a').text();
            if (inArray(giveawayCreator.toLowerCase(), staff) == -1 && giveawayCreator != user['username']) {
                if (ignoredUsers.hasOwnProperty(giveawayCreator)) {
                    giveaway.css('opacity', '0.4');
                    giveaway.find('.title').css('font-size', '11px');
                    giveaway.find('.title').prepend('<span style="color: #DD7070">Ignored giveaway by <a style="color: #347DB5;"href="http://www.steamgifts.com/user/' + giveawayCreator + '">' + giveawayCreator + '</a>: </span>');
                    giveaway.find('.center, .right, .description, .entries').hide();
                }
            }

            //Annoying spacing fix because page 1 is rendering new line/tabs as a space.
            if (endlessPage) {
                giveaway.css({
                    'margin-right': '4px',
                    'margin-top': '4px'
                });
            }
            giveaway.find('.center').css('margin-right', '5px');

            if (giveaway.find('.contributor_only').length) {
                giveawayContributorValue = giveaway.find('.contributor_only').text().trim().replace(/([^0-9^.]*)/g, '');

                giveaway.find('.right').append('<div class="sgpTileViewContributor">$' + giveawayContributorValue + '</div>');

                if (giveaway.find('.contributor_only.green').length) {
                    giveaway.find('.sgpTileViewContributor').addClass('green');
                }
            }

            if (giveawayCopies > 1) {
                giveaway.find('.right').append('<div class="sgpTileViewCopies">' + giveawayCopies + ' Copies</div>')
            }

            giveaway.find('.right').append('<div class="sgpTileViewTimeleft">' + giveaway.find('.time_remaining>strong').text() + '</div>').append('<div class="sgpTileViewInfoAbsolute"><div class="sgpTileViewInfoRelative"></div></div>');

            var tileGiveawayInfo = giveaway.find('.right>.sgpTileViewInfoAbsolute>.sgpTileViewInfoRelative');

            var giveawayCreator = giveaway.find('.created_by>a:first').text();
            var giveawayCreatorAvatar = giveaway.find('a.avatar').css('background-image');

            if (giveawayCreatorAvatar != undefined) {
                giveawayCreatorAvatar = giveawayCreatorAvatar.replace('_medium', '');
            } else {
                giveawayCreatorAvatar = '';
            }

            tileGiveawayInfo.append('<div class="sgpTileViewInfoTitle">' + giveaway.find('.title>a:first').text() + '</div>\
        <div class="sgpTileViewInfoAvatar"><a class="sgpReplyAvatar" href="http://www.steamgifts.com/user/' + giveawayCreator + '" title="Created by ' + giveawayCreator + '"><div class="sgpReplyAvatarOverlay"></div></a></div>\
        <div class="clear"></div>');

            tileGiveawayInfo.find('a.sgpReplyAvatar').css('background-image', giveawayCreatorAvatar);

            var giveawayPoints = parseInt(giveaway.find('.title>span:last').text().replace(/([^0-9]*)/g, ''));

            tileGiveawayInfo.append('<strong>' + giveawayCopies + '</strong> Copies\
        <span style="float: right;"><strong>' + giveawayPoints + 'P</strong></span><div class="clear"></div>\
        <span><strong>' + giveaway.find('.time_remaining>strong').text().replace(' ', '</strong> ') + '</span>\
        <span style="float: right;"></span>');

            if (configGet('gi_showwinchance') && !giveaway.find('.time_remaining:contains(begins)').length) {
                tileGiveawayInfo.find('span:last').append('<strong>' + winChance + '%</strong> Win Chance');
            }
            tileGiveawayInfo.append('<div class="clear"></div>\
        <span><strong>' + giveawayEntries + '</strong> Entries</span>\
        <span style="float: right;"><strong>' + giveaway.find('.entries>span:contains(Comment)').text().replace(' ', '</strong> '));

            var giveawayGroupOnly = giveaway.find('.group_only').length;

            if (giveaway.find('.contributor_only').length) {
                giveawayContributorValue = giveaway.find('.contributor_only').text().trim().replace(/([^0-9^.]*)/g, '');

                if (giveaway.find('.contributor_only.green').length) {
                    tileGiveawayInfo.find('.sgpTileViewInfoAvatar').after('<div class="clear"></div><strong>Contributor (<span style="color: #4F5F1D;">$' + giveawayContributorValue + '</span>)</strong>');
                } else {
                    tileGiveawayInfo.find('.sgpTileViewInfoAvatar').after('<div class="clear"></div><strong>Contributor (<span style="color: #dd7070;">$' + giveawayContributorValue + '</span>)</strong>');
                }
            }

            tileGiveawayInfo.append('<div class="clear"></div><a style="color: #347DB5;" id="sgpAddToFilter" href="">Add to Filter</a>');

            if (giveawayGroupOnly) {
                tileGiveawayInfo.find('.sgpTileViewInfoAvatar').after('<div class="clear"></div><strong>Group Giveaway</strong>');
                giveaway.find('.right').css({
                    'background-color': '#AFCF4D',
                    'border': '1px solid #758F23'
                });
                tileGiveawayInfo.css({
                    'background-color': '#AFCF4D',
                    'border-bottom': '1px solid #758F23',
                    'border-left': '1px solid #758F23',
                    'border-right': '1px solid #758F23'
                });
            }

            //Grid view.
            if (configGet('gi_gridview') && page['id'] != 'search') {
                giveaway.css({
                    'display': 'none',
                    'padding': '0',
                    'border-top': 'none',
                    'border-bottom': 'none'
                });
                giveaway.find('.left, .center').hide();
            } else {
                giveaway.find('.sgpTileViewTimeleft, .sgpTileViewCopies, .sgpTileViewContributor').hide();
            }

            //Wishlist highlighting
            if (configGet('gi_highlightwishlist') && wishlist.hasOwnProperty(giveaway.find('.title>a').text())) {
                giveaway.find('.right .sgpTileViewInfoAvatar').after('<div class="clear"></div><strong>Wishlist Giveaway</strong>');
                giveaway.find('.description, .right, .description span, .created_by a').css({
                    'background': '#A159AD',
                    'color': '#FFFFFF'
                });
                giveaway.find('.right').css('border', '1px solid #55235F');
                giveaway.find('.contributor_only').css('background-color', '#F4F4F4');
                giveaway.find('.right>.sgpTileViewInfoAbsolute>.sgpTileViewInfoRelative').css({
                    'color': '#FFFFFF',
                    'background': '#A159AD',
                    'border-bottom': '1px solid #55235F',
                    'border-left': '1px solid #55235F',
                    'border-right': '1px solid #55235F'
                });
                giveaway.find('.title').prepend('<span style="color: #A159AD;">Wishlist: </span>');
            }
        });

        if (!endlessPage) {
            //doForum the 'New from the Forums' section.
            doForum($('.discussions'));

            //Do usertags for latest received and top contributor sections.
            $('.recent_winners, .top_contributors').find('.details').each(function() {
                var username = $(this).find('strong:first').text().trim();
                if (usertags.hasOwnProperty(username)) {
                    $(this).find('a:first').after(' <span style="font-size: 12px; color:' + usertags[username]['color'] + '; font-weight:bold;">' + usertags[username]['usertag'] + '</span>');
                }
            });

            //Remove featured giveaway.
            if (configGet('gi_hidefeatured')) {
                $('.featured:first').hide();

                //Replace featured giveaway.
                if (configGet('gi_replacefeatured')) {
                    $('.wrapper:first').css('padding', '5px 0');
                    $('.discussions').clone().prependTo('.wrapper>.content:first');
                    $('.discussions:first').attr('style', '');
                    $('.discussions:first').find('.details, .reply').attr('style', '');
                    $('.discussions:first').find('.row').css('padding', '6px 0');
                    $('.discussions:first').find('img:first').attr('src', 'http://www.steamgifts.com/img/new_from_the_forums.png');
                    $('.ajax_gifts:first').css('margin-top', '5px');
                }
            }

            //Add giveaway search.
            $('.sub_navigation:first>h1').after('<input type="text" class="sgpInput" id="sgpSearchGiveawaysInput" style="margin-top: 2px; margin-left: 5px; background-color: #FDFDFD; background-image: url(http://www.steamgifts.com/img/search_icon.png); background-position: right center; background-repeat: no-repeat; display: inline-block;" name="Search giveaways..." value="Search giveaways..." size="40"> <a href="" id="sgpSearchGiveawaysCancel" style="display: inline-block;">Cancel</a><div id="sgpGiveawayDropdowns" style="display: inline-block; float: none !important; position: relative; bottom: 18px; left: 295px;"></div>');
        }

        //Post spacing.
        if (!configGet('gi_gridview')) {
            obj.find('.post:not(.post[style*="227, 236, 245"]):not(.post[style*="#E3ECF5"])').css('padding', configGet('ge_postpadding') + 'px 0');
            obj.find('.post[style*="227, 236, 245"], .post[style*="#E3ECF5"]').css('padding', configGet('ge_postpadding') + 'px 15px 0px 15px');
        }
        obj.find('.recent_winners .row:not(.first), .top_contributors .row:not(.first), .discussions:last .row:not(.first)').css('padding', configGet('ge_rowpadding') + 'px 0');
    }

    /**
     * SteamGifts Plus - Manage pages.
     */
    function doManage() {
        if (page['id'] == 'won') {
            return;
        }

        if (configGet('gi_showwinchance')) {

            $('.row.headings .entries').after('<div class="sgpWinChance">Win Chance</div>');

            if (page['id'] != 'created') {
                $('.title').css('width', '365px');
            } else {
                $('.c_sent, .c_received').css('width', '125px');
                $('.status').css('width', '160px');
                $('.entries').css('width', '40px');
            }

            $('.row:not(.headings)').each(function() {
                var giveaway = $(this);

                if (!giveaway.find('.status:contains(Closed)').length && !giveaway.find('.status:contains(Open)').length) {
                    giveaway.find('.entries').after('<div class="sgpWinChance">N/A</div>')
                } else {
                    var giveawayTitle = giveaway.find('.title').text();
                    var giveawayCopies = giveawayTitle.match(/\(([0-9]*(,[0-9]*)?)\s*Copies\)/g);

                    if (giveawayCopies) {
                        giveawayCopies = parseInt(giveawayCopies.toString().replace(/([^0-9*])/g, ''));
                    } else {
                        giveawayCopies = 1;
                    }

                    var giveawayEntries = parseInt(giveaway.find('.entries').text().trim().replace(/([^0-9]*)/g, ''));

                    var winChance = Math.round((1 / (giveawayEntries / giveawayCopies) * 100) * 100) / 100;

                    if (winChance < 0.001) {
                        winChance = 0.001;
                    } else if (winChance > 100) {
                        winChance = 100;
                    }
                    giveaway.find('.entries').after('<div class="sgpWinChance">' + winChance + '%</div>')
                }
            });
            $('.sgpWinChance').css({
                'width': '70px',
                'float': 'left',
                'padding': '0 15px',
                'text-align': 'center',
                'text-shadow': '1px 1px #FFFFFF'
            });
        }
    }

    /**
     * SteamGifts Plus - User Profiles
     */
    function doUser() {
        //User reports
        if (page['name'] == 'reports') {
            $('.wrapper .content:first').prepend('<div class="sgp_alert_warning" style="background-color: #CC0000;font-weight: bold;border: 0 none;border-radius: 15px 15px 15px 15px;color: #FFFFFF;font-size: 12px;line-height: 31px;margin-bottom: 25px;text-align: center;box-shadow: 0 10px 10px rgba(255, 255, 255, 0.4) inset;">Moderators currently cannot view user reports. Please submit a <a style="color: #E5E5E5;" href="http://www.steamgifts.com/support/new">Support Ticket</a> instead.</div>');
        } else if (page['name'] == 'suspensions') {
            var suspendURL = getURLParameter('url');
            if (suspendURL != null) {
                $('input[name="url"]').val(suspendURL);
            }
        } else {
            //Check if valid profile.
            if ($('.profile').length) {
                var username = $('.details .heading').find('strong:first').text().toString().trim();
                var usernameSafe = username.toLowerCase();

                //SGP ignore buttons.
                if ($('a.button:contains(Report User)').length && inArray(username.toLowerCase(), staff) == -1 && username != user['username']) {
                    if (!ignoredUsers.hasOwnProperty(username)) {
                        $('<a class="button delete_giveaway_btn" name="' + username + '" id="sgpIgnoreAdd" href="" style="margin-left:5px;">Ignore User</a>').insertBefore('a.button:contains(Report User)');
                    } else {
                        $('<a class="button delete_giveaway_btn" name="' + username + '" id="sgpIgnoreRemove" href="" style="margin-left:5px;">Unignore User</a>').insertBefore('a.button:contains(Report User)');
                    }
                    //Create space for the extra button by removing some text.
                    $('li.selected', '.sub_navigation').children('a').text('Giveaways');
                }

                $('a.button:contains(Report User)').attr('href', 'http://www.steamgifts.com/support/new?type=report&user=' + username);

                //Stuff under avatar
                $('div.left', '.profile').prepend('<div class="sgpAvatar" style="float:left; width:156px;"></div>');
                $('div.avatar').appendTo($('.sgpAvatar'));

                //Ignored user styling
                if (ignoredUsers.hasOwnProperty(username)) {
                    $('img', 'div.avatar').css('opacity', '0.1');
                    $('div.avatar').css('background-image', 'url(' + image["userIgnoredAvatar"] + ')');
                    $('.details .heading').find('strong:first').css('color', '#dd7070');
                }

                //Staff tags
                if (inArray(username.toLowerCase(), staff) != -1) {
                    $('.sgpAvatar').append('<div class="sgpProfileTagStaff">SteamGifts Staff</div>');
                }

                //Awards/badges
                $('.sgpAvatar').append('<div class="sgpProfileAwards"></div>');

                if (configGet('u_awards')) {
                    if ($('.row_left:contains(Registered)').parent().children('.row_right').text().match(/1 year/gi)) {
                        $('.sgpProfileAwards').append('<div style="position:relative; display:inline-block;"><img class="sgpProfileAward" id="sgpProfileAward_1year" src="' + image.award["1Year"] + '" ><div class="sgpProfileAwardInfo" id="sgpProfileAward_1year" style="width:180px; display:none;"><span style="font-weight:bold;">1 Year Club</span><br>Been a member for 1 year.</div></div>');
                    } else if ($('.row_left:contains(Registered)').parent().children('.row_right').text().match(/2 year/gi)) {
                        $('.sgpProfileAwards').append('<div style="position:relative; display:inline-block;"><img class="sgpProfileAward" id="sgpProfileAward_2year" src="' + image.award["2Year"] + '" ><div class="sgpProfileAwardInfo" id="sgpProfileAward_2year" style="width:180px; display:none;"><span style="font-weight:bold;">2 Year Club</span><br>Been a member for 2 years.</div></div>');
                    }
                    if (parseInt($('.row_left:contains(Value)').parent().children('.row_right').text().replace(/\D/g, '')) >= 50000) {
                        $('.sgpProfileAwards').append('<div style="position:relative; display:inline-block;"><img class="sgpProfileAward" id="sgpProfileAward_500value" src="' + image.award["500Value"] + '" ><div class="sgpProfileAwardInfo" id="sgpProfileAward_500value" style="width:180px; display:none;"><span style="font-weight:bold;">Contributor</span><br>Gifted $500 in giveaways.</div></div>');
                    }
                    if (parseInt($('.row_left:contains(Gifts Won)').parent().children('.row_right').text()) >= 25) {
                        $('.sgpProfileAwards').append('<div style="position:relative; display:inline-block;"><img class="sgpProfileAward" id="sgpProfileAward_25wins" src="' + image.award["25Wins"] + '" ><div class="sgpProfileAwardInfo" id="sgpProfileAward_25wins" style="width:130px; display:none;"><span style="font-weight:bold;">Lucky</span><br>Win 25 giveaways.</div></div>');
                    }

                    var awardsData = lscache.get('userAwards');
                    if (awardsData == null) {
                        awardsData = {};
                    }
                    if (awardsData.hasOwnProperty(usernameSafe)) {
                        if (awardsData[usernameSafe].hasOwnProperty('groupchat') && awardsData[usernameSafe]['groupchat']) {
                            $('.sgpProfileAwards').append('<div style="position:relative; display:inline-block;"><img class="sgpProfileAward" id="sgpProfileAward_groupchat" src="' + image.award["GroupChat"] + '" ><div class="sgpProfileAwardInfo" id="sgpProfileAward_groupchat" style="width:280px; display:none;"><span style="font-weight:bold;">Likes To Chat</span><br>Actively participates in S.Gifts group chat.</div></div>');
                        }
                        // if (awardsData[usernameSafe].hasOwnProperty('community') && awardsData[usernameSafe]['community']) {
                        // $('.sgpProfileAwards').append('<div style="position:relative; display:inline-block;"><img class="sgpProfileAward" id="sgpProfileAward_community" src="'+image.award["Community"]+'" ><div class="sgpProfileAwardInfo" id="sgpProfileAward_community" style="width:280px; display:none;"><span style="font-weight:bold;">Gold Star</span><br>Recognition for contributing to SteamGifts.</div></div>');   
                        // }
                        if (awardsData[usernameSafe].hasOwnProperty('halloween2012') && awardsData[usernameSafe]['halloween2012']) {
                            $('.sgpProfileAwards').append('<div style="position:relative; display:inline-block;"><img class="sgpProfileAward" id="sgpProfileAward_halloween2012" src="' + image.award["Halloween2012"] + '" ><div class="sgpProfileAwardInfo" id="sgpProfileAward_halloween2012" style="width:350px; display:none;"><span style="font-weight:bold;">Saw a Ghost</span><br>Commented on the 2012 Halloween hidden giveaway.</div></div>');
                        }
                        if (awardsData[usernameSafe].hasOwnProperty('halloween2013') && awardsData[usernameSafe]['halloween2013']) {
                            $('.sgpProfileAwards').append('<div style="position:relative; display:inline-block;"><img class="sgpProfileAward" id="sgpProfileAward_halloween2013" src="' + image.award["Halloween2013"] + '" ><div class="sgpProfileAwardInfo" id="sgpProfileAward_halloween2013" style="width:320px; display:none;"><span style="font-weight:bold;">Gift-o&#39;-lantern</span><br>Participated in the 2013 Halloween forum event.</div></div>');
                        }
                        if (awardsData[usernameSafe].hasOwnProperty('TriviaKnight') && awardsData[usernameSafe]['TriviaKnight']) {
                            $('.sgpProfileAwards').append('<div style="position:relative; display:inline-block;"><img class="sgpProfileAward" id="sgpProfileAward_TriviaKnight" src="' + image.award["TriviaKnight"] + '" ><div class="sgpProfileAwardInfo" id="sgpProfileAward_TriviaKnight" style="width:370px; display:none;"><span style="font-weight:bold;">TriviaKnight</span><br>Placed top 5 in a S.Gifts group chat Trivia Night contest.</div></div>');
                        }
                    }

                    $('.sgpProfileAward').live('mouseover', function() {
                        $('div#' + $(this).attr('id')).show();
                    });

                    $('.sgpProfileAward').live('mouseout', function() {
                        $('div#' + $(this).attr('id')).hide();
                    });
                }

                //Usertag
                $('<div class="row" style="padding-top:0; margin-top:-4px;"><div class="row_left sgpProfileUsertag"> </div><div class="clear_both"></div></div><div class="divider"></div>').insertAfter('.heading:first', '.details');
                if (usertags.hasOwnProperty(username)) {
                    var usertagColor = usertags[username]['color'];
                    if (usertagColor == 'rgb(99, 110, 117)') {
                        //Readablity fix for default text.
                        usertagColor = 'inherit';
                    }
                    $('.sgpProfileUsertag').prepend('<a id="sgpTagUser" href="" style="text-shadow:-1px -1px #1D5380; color: ' + usertagColor + '; text-decoration: none;">' + usertags[username]['usertag'] + ' <img title="Tag User" src="' + image["usertag"] + '" style="margin-top: -5px; position: relative; top: 3px;"></a>');
                } else {
                    $('.details .heading').find('strong:first').parent().after('<div style="display:inline-block;"><a id="sgpTagUser" href=""><img title="Tag User" src="' + image["usertag"] + '"></a></div>');
                }
                $('<div class="clear_both"></div><div id="sgpProfileTagForm" name="' + username + '"><div class="sgpDropdownTextboxRelative"><div class="sgpDropdownTextboxAbsolute"><div class="sgpDropdownTextboxHeading" style="top:14px; margin-left:278px;"><a href=""><img src=http://www.steamgifts.com/img/dropdown_arrow.png /></a></div><div class="sgpDropdownTextboxItems" style="display: none; width:286px; margin-top:-7px; margin-left:0;"><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:#8BBA65;" href="" class="sgpDropdownTextboxItem">Green</a></div><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:#dd7070;" href="" class="sgpDropdownTextboxItem">Red</a></div><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:#579AD4;" href="" class="sgpDropdownTextboxItem">Blue</a></div><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:#A85ACF;" href="" class="sgpDropdownTextboxItem">Purple</a></div><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:#F67FFF;" href="" class="sgpDropdownTextboxItem">Pink</a></div><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:#FF8A00;" href="" class="sgpDropdownTextboxItem">Orange</a></div><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:inherit;" href="" class="sgpDropdownTextboxItem">Default</a></div></div></div></div> <input type="text" class="sgpInput" id="sgpTaggedUsersAddTag" name="User tag." value="User tag." maxlength="40" style="width:288px; z-index:35; position:relative;">\
        <div class="clear_both"></div><a style="margin-top:5px; color:#FFFFFF;" class="sgpAddListItem" id="sgpTagUserAdd" href="">Set Tag</a> <a style="margin-top:5px; color:#FFFFFF;" class="sgpAddListItem" id="sgpTagUserRemove" href="">Remove Tag</a> or <a id="sgpTagUser" href="">cancel.</a> <div class="clear_both"></div></div>').appendTo('.sgpProfileUsertag').hide();

                $('#sgpTagUser').live('click', function() {
                    $('#sgpProfileTagForm').slideToggle('slow');
                    return false;
                });
            }
        }
    }

    /**
     * SteamGifts Plus - Control Panel
     */
    function doControlPanel() {
        //Retitle.
        $('title').text('SteamGifts Plus ' + addon["version"] + ' Control Panel');

        //Remove homepage content.
        $('.bg_gradient.shadow').removeClass('shadow');
        $('.content:has(.featured)').remove();
        $('.search', '#navigation').replaceWith('<div class="search disabled"></div>');

        //Replace homepage content with our settings page.
        $('.content', '.wrapper').replaceWith('<div class="register" style="width:700px"><div class="invites"><div class="input" style="padding:0px;"><div class="title"><a href="http://www.steamgifts.com/forum/u2zKI/steamgifts-plus/page/' + (configGet('f_newestfirst') ? '31337/' : '1/') + '" style="color: #4F565A; text-decoration: none;"><img src=' + image["icon16"] + ' /> SteamGifts Plus Alternative ' + addon["version"] + ' Control Panel</a></div><div class="title important" style="float:right;margin-top:0;font-size: 12px;"><a href="" class="sgpMenu" id="sgpCP_Changelog">View changelog</a></div><div class="clear_both"></div></div><div class="divider"></div>');

        //Menu
        $('.invites', '.wrapper').append('<a class="button sgpMenu" id="sgpCP_GeneralPreferences" href="" style="margin-left:5px;">General Preferences</a><a class="button sgpMenu" id="sgpCP_GiveawayPreferences" href="" style="margin-left:5px; width:120px;">Giveaway Preferences</a><a class="button sgpMenu" id="sgpCP_ForumPreferences" href="" style="margin-left:5px;">Forum Preferences</a><a class="button sgpMenu" id="sgpCP_UserPreferences" href="" style="margin-left:5px;">User Preferences</a><a class="button sgpMenu" id="sgpCP_AdvancedOptions" href="" style="margin-left:5px;">Advanced Options</a><div class="clear_both"></div><div class="divider"></div>');

        //General settings.
        $('<div class="sgpPage" id="sgpCP_GeneralPreferences">\
    <div class="input" style="padding:0 0 8px 0;"><div class="title">General Preferences</div><div class="clear_both"></div></div>\
    <div class="important"><div class="sgpCheckbox" id="ge_notifyupdate"> Update Notifications</div> - Notifies you when the addon has automatically updated.</a></div>\
    <div class="important"><div class="sgpCheckbox" id="ge_highlightunread"> Track New Comments</div> - Tracks and highlights new comments since you viewed the page.</div>\
    <div class="important"><div class="sgpCheckbox" id="ge_comments_ids"> Comment #IDs</div> - Enables comment #IDs which you can direct link to other users.</div>\
    <div class="important"><div class="sgpCheckbox" id="ge_comments_highlightop"> Highlight OP</div> - Highlights all comments by the original poster (OP).</div>\
    <div class="important"><div class="sgpCheckbox" id="ge_floatdown_menu"> Float Down Menu</div> - Keeps the SteamGifts navigation menu always on your screen.</div>\
    <div class="important"><div class="sgpCheckbox" id="ge_comments_imagehover"> Hover Images</div> - Displays popup images when hovering over an image link in a comment.</div>\
    <div class="important"><div class="sgpCheckbox" id="ge_be_bettereditor"> Better Comment Editor</div> - Enables the Better Comment Editor.</div>\
    <div class="important" style="margin-left:20px;"><div class="sgpCheckbox" id="ge_be_livepreview"> Live Preview</div> - Previews how your comment will look with formatting as you type it.</div>\
    <div class="important" style="margin-left:20px;"><div class="sgpCheckbox" id="ge_be_formatbuttons"> Format Buttons</div> - Adds buttons to insert markdown formatting into your comment.</div>\
    <div class="important" style="margin-left:20px;"><div class="sgpCheckbox" id="ge_be_newlineparse"> Parse Line Breaks</div> - Automatically converts all line breaks into markdown.</div>\
    </div>').appendTo('.invites', '.wrapper');

        //Giveaway settings
        $('<div class="sgpPage" id="sgpCP_GiveawayPreferences">\
    <div class="input" style="padding:0 0 8px 0;"><div class="title">Giveaway Preferences</div><div class="clear_both"></div></div>\
    <div class="important"><div class="sgpCheckbox" id="gi_endlessscrolling"> Endless Giveaway Scrolling</div> - Automatically loads the next giveaway page when you reach the bottom.</strike></div>\
    <div class="important" style="margin-left:20px;"><div class="sgpCheckbox" id="gi_endlessscrolling_seamless"> Seamless Scrolling</div> - Hides the page # of # messages.</div>\
    <div class="important"><div class="sgpCheckbox" id="gi_highlightwishlist"> Highlight Wishlist Giveaways</div> - Highlights giveaways for items in your wishlist.</div>\
    <div class="important"><div class="sgpCheckbox" id="gi_hidefeatured"> Hide Featured Giveaway</div> - Hides the featured giveaway.</div>\
    <div class="important" style="margin-left:20px;"><div class="sgpCheckbox" id="gi_replacefeatured"> Replace with New from the Forums</div> - Replaces the Featured Giveaway with the New from the Forums box.</div>\
    <div class="important"><div class="sgpCheckbox" id="gi_showwinchance"> Show Chance to Win</div> - Shows you the percentage chance to win.</div>\
    <div class="important"><div class="sgpCheckbox" id="gi_quickview"> Quick View</div> - Clicking on a giveaway\'s logo will open a popup of the giveaway that you can enter and comment from.</div>\
    <div class="important"><div class="sgpCheckbox" id="gi_gridview"> Grid View</div> - Giveaways are displayed in a grid of their game logos for faster browsing.</div>\
    <div class="divider"></div><div class="clear_both"></div>\
    <div class="input" style="padding:0 0 8px 0;"><div class="title">Giveaway Filtering</div><div class="clear_both"></div></div>\
    <div class="important"><div class="sgpCheckbox" id="gi_f_showpublic"> Show All Public</div> <div class="sgpCheckbox" id="gi_f_showgroup"> Show Group</div> <div class="sgpCheckbox" id="gi_f_showentered"> Show Entered</div> <div class="sgpCheckbox" id="gi_f_contributor_green"> Show Green</div> <div class="sgpCheckbox" id="gi_f_contributor_red"> Show Red</div> <div class="sgpCheckbox" id="gi_f_limitpoints"> Limit by Points (P) Available</div>\
    <div class="important"><div class="sgpCheckbox" id="gi_f_wishlistonly"> Show Wishlist Only</div> <div class="sgpCheckbox" id="gi_f_dlc"> Hide DLC for games I don\'t own</div> <div class="sgpCheckbox" id="gi_f_entrylimit_enabled"> Entry Limit</div> (<div class="sgpCheckbox" id="gi_f_entrylimit_percopy"> Per Copy</div>) <strong style="color:#4F565A;"><input class="sgpFilterInput" id="gi_f_entrylimit_value" type="text" size="5" value="0" maxlength="5" style="margin-top:0;"> </strong></div>\
    <div class="important" style="margin-top: 0px;"><strong style="color:#4F565A;">Minimum Copies: <input class="sgpFilterInput" id="gi_f_minimumcopies" type="text" size="5" value="0" maxlength="5" style="margin-top:0;"> Minimum Win Chance: <input class="sgpFilterInput" id="gi_f_minimumchance" type="text" size="5" value="0" maxlength="5" style="margin-top:0;">%</strong></div>\
    <div class="important" style="color:#4F565A;">$ <input class="sgpFilterInput" id="gi_f_contributor_value_min" type="text" size="7" value="0" maxlength="7" style="margin-top:0;"> <div style="margin-top: 5px; margin-left: 5px; margin-right: 5px; width: 510px; display: inline-block;" id="sgpContributorValueRangeSlider"></div> $ <input class="sgpFilterInput"id="gi_f_contributor_value_max" type="text" size="7" value="0" maxlength="7" style="margin-top:0;"></div>\
    <div class="divider"></div><div class="clear_both"></div>\
    <div class="important"><div class="sgpCheckbox" id="gi_f_enabled"> Custom Filters</div> - Add games or partial game names to filter. <i>Case insensitive. Use * as a wildcard.</i></div>\
    <input type="text" class="sgpInput" id="sgpFilteredGamesAddFilter" name="Giveaway name to filter. Case Insensitive." value="Giveaway name to filter. Case Insensitive." size="50"> <a class="sgpAddListItem" id="sgpFilterGame" href="" style="color:#FFFFFF;"">Add to Filter</a>\
    <div class="relative_dropdown" style="width:150px; padding-top:7px;"><div class="absolute_dropdown" style="width:150px;"><div class="heading" style="font-size:12px; margin-top:1px; margin-bottom:1px;"><a href="" style="padding-left:15px; padding-right:25px;">Import / Export</a></div><div class="items" style="display: none;"><div class="item" style="cursor:pointer;"><a id="sgpFilterExportSGP">Export SteamGifts Plus</a></div><div class="item" style="cursor:pointer;"><a id="sgpFilterImportSGP">Import SteamGifts Plus</a></div><div class="item" style="cursor:pointer;"><a id="sgpFilterImportSGE">Import Zo\'s Addon (SGE)</a></div></div></div></div>\
    <div class="sgpFilteredGamesList" style="margin-top:10px;"></div>\
    <div class="important"><div class="sgpCheckbox" id="gi_f_library_enabled"> Library Filters</div> - Filters games in your library. <i>Filtering for specific library games can enabled or disabled.</i><br><strong style="color:#DD7070;"><img style="margin-bottom:-3px;" src="http://www.steamgifts.com/img/bullet_reported.png"><a href="http://www.steamgifts.com/filter">SteamGifts Filter</a> must be disabled to use SteamGifts Plus Library Filtering.</strong></div>\
    <div class="sgpFilteredGamesListLibrary" style="margin-top:10px;"></div>\
    </div>').appendTo('.invites', '.wrapper').hide();

        $('.sgpFilteredGamesList').append('<div id="sgpFilteredGamesListCustom" style="overflow: hidden;"></div><div class="divider" style="margin-bottom: 0;"></div><div class="clear_both"></div>');

        $('.sgpFilteredGamesListLibrary').append('<div class="divider" style="margin-bottom: 7px;"></div><div class="important"><strong style="color:#4F565A;"><span style="color: #8BBA65;"><img style="margin-bottom: -2px; width: 12px; height: 12px;" src="http://www.steamgifts.com/img/verify_success.png"> Enabled</span> Library Filters</strong></div><div class="clear_both"></div>\
    <div id="sgpFilteredGamesListLibraryEnabled"></div></div><div class="divider" style="margin-bottom: 0;"></div><div class="clear_both"></div>\
    <div class="important"><strong style="color:#4F565A;"><span style="color: #DD7070;"><img style="margin-bottom: -2px; width: 12px; height: 12px;" src="http://www.steamgifts.com/img/verify_error.png"> Disabled</span> Library Filters</strong></div><div class="clear_both"></div>\
    <div id="sgpFilteredGamesListLibraryDisabled"></div>');

        //Forum settings
        $('<div class="sgpPage" id="sgpCP_ForumPreferences">\
    <div class="input" style="padding:0 0 8px 0;"><div class="title">Forum Preferences</div><div class="clear_both"></div></div>\
    <div class="important"><div class="sgpCheckbox" id="f_endlessscrolling"> Endless Forum Scrolling</div> - Automatically loads the next page in forums and topics when you reach the bottom.</div>\
    <div class="important" style="margin-left:20px;"><div class="sgpCheckbox" id="f_endlessscrolling_seamless"> Seamless Scrolling</div> - Hides the page # of # messages.</div>\
    <div class="important"><div class="sgpCheckbox" id="f_markreplied"> Mark Topics You\'ve Replied To</div> - Marks topics you have replied to with a lighter background and a blue asterisk.</div>\
    <div class="important"><div class="sgpCheckbox" id="f_newestfirst"> Newest Comment First</div> - Orders comments in a topic by newest comment first.</div>\
    <div class="important"><div class="sgpCheckbox" id="f_highlightstafftopics"> Highlight Topics Created by SteamGifts Staff</div> - Highlights all topics created by SteamGifts staff.</div>\
    </div>').appendTo('.invites', '.wrapper').hide();

        //User settings
        $('<div class="sgpPage" id="sgpCP_UserPreferences">\
    <div class="input" style="padding:0 0 8px 0;"><div class="title">User Preferences</div><div class="clear_both"></div></div>\
    <div class="important"><div class="sgpCheckbox" id="u_awards"> User Badges</div> - Show user badges on profiles. <a id="sgpViewAllBadges" href="">View all Badges</a></div><div class="divider"></div>\
    <div class="important"><strong style="color:#4F565A;">Tagged Users</strong> - Tag a user with a nickname or short note to display next to their name.</div>\
    <input type="text" class="sgpInput" id="sgpTaggedUsersAddUsername" name="Username to tag. Case Insensitive." value="Username to tag. Case Insensitive." size="40"><div class="sgpDropdownTextboxRelative"><div class="sgpDropdownTextboxAbsolute"><div class="sgpDropdownTextboxHeading"><a href=""><img src=http://www.steamgifts.com/img/dropdown_arrow.png /></a></div><div class="sgpDropdownTextboxItems" style="display: none;"><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:#8BBA65;" href="" class="sgpDropdownTextboxItem">Green</a></div><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:#dd7070;" href="" class="sgpDropdownTextboxItem">Red</a></div><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:#579AD4;" href="" class="sgpDropdownTextboxItem">Blue</a></div><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:#A85ACF;" href="" class="sgpDropdownTextboxItem">Purple</a></div><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:#F67FFF;" href="" class="sgpDropdownTextboxItem">Pink</a></div><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:#FF8A00;" href="" class="sgpDropdownTextboxItem">Orange</a></div><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:#636E75;" href="" class="sgpDropdownTextboxItem">Default</a></div></div></div></div> <input type="text" class="sgpInput" id="sgpTaggedUsersAddTag" name="User tag." value="User tag." maxlength="40" style="width:302px; z-index:35; position:relative;"> <a class="sgpAddListItem" id="usertagAdd" href="">Tag User</a><br><div class="sgpTaggedUsersList" style="margin-top:10px;"></div>\
    <div class="divider"></div><div class="important"><strong style="color:#4F565A;">Ignored Users</strong> - Hides all comments, topics and giveaways posted by ignored users. (SteamGifts staff cannot be ignored.)</div>\
    <input type="text" class="sgpInput" id="sgpIgnoredUsersAddUsername" name="Username to ignore. Case Insensitive." value="Username to ignore. Case Insensitive." size="40"> <a class="sgpAddListItem" id="ignoreUserAdd" href="">Ignore User</a><br><div class="sgpIgnoredUsersList" style="margin-top:10px;"></div>\
    </div>').appendTo('.invites', '.wrapper').hide();

        //Advanced
        $('<div class="sgpPage" id="sgpCP_AdvancedOptions">\
    <div class="input" style="padding:0 0 8px 0;"><div class="title">Advanced Options</div><div class="clear_both"></div></div>\
    <div class="important"><strong style="color:#4F565A;"><a id="sgp_AO_DeleteAddonCache" href="">Delete Saved Addon Data</a></strong> - <strong style="color:#DD7070;"><img src="http://www.steamgifts.com/img/bullet_reported.png" style="margin-bottom:-3px;" />This will irreversibly delete all SteamGifts Plus data.</strong></div>\
    <div class="important"><div class="divider"></div><strong style="color:#4F565A;">New Comment Tracker Expiration</strong><div style="float:right;" class="sgpUnreadCommentExpireRange">4 Weeks</div></div><div class="clear_both"></div><div style="margin-top:5px;" id="sgpUnreadCommentExpireSlider"></div><div class="important"><strong style="color:#DD7070;"><img src="http://www.steamgifts.com/img/bullet_reported.png" style="margin-bottom:-3px;" />SteamGifts plus will save more data in cache the higher this is set.</strong></div>\
    <div class="divider"></div><div class="input" style="padding:0 0 8px 0;"><div class="title">Debug</div><div class="clear_both"></div></div>\
    <div class="important"><strong style="color:#4F565A;">Logged in?</strong>: ' + user['loggedIn'] + ' (' + user['username'] + ')</div>\
    <div class="important"><strong style="color:#4F565A;">Now</strong>: ' + now + '</div>\
    <div class="important"><strong style="color:#4F565A;">lastAwardUpdate</strong>: ' + lscache.get('lastAwardUpdate') + ' <a href="" id="sgpForceUpdateAwards">Force Update</a></div>\
    <div class="important"><strong style="color:#4F565A;">lastWishlistUpdate</strong>: ' + lscache.get('lastWishlistUpdate') + ' <a href="" id="sgpForceUpdateWishlist">Force Update</a></div>\
    <div class="important"><strong style="color:#4F565A;">lastLibraryUpdate</strong>: ' + lscache.get('lastLibraryUpdate') + ' <a href="" id="sgpForceUpdateLibrary">Force Update</a></div>\
    <div class="important"><strong style="color:#4F565A;">lastDLCUpdate</strong>: ' + lscache.get('lastDLCUpdate') + ' <a href="" id="sgpForceUpdateDLC">Force Update</a></div>\
    <div class="important"><strong style="color:#4F565A;">localStorage Free Space</strong>: ' + localStorageRemainingSpace() + ' Bytes</div>\
    </div>').appendTo('.invites', '.wrapper').hide();

        //Changelog
        $('<div class="sgpPage" id="sgpCP_Changelog">\
    <div class="input" style="padding:0 0 8px 0;"><div class="title">SteamGifts Plus Changelog</div><div class="clear_both"></div></div>\
    <div class="important"><iframe style="width: 100%; height:400px; background-color: #FFFFFF; border: 1px solid #ECECEC; border-radius: 5px 5px 5px 5px; padding: 5px;" frameborder="0" src="http://github.com/sgplus-alternative/release/raw/master/changelog.txt"></iframe></div>\
    </div>').appendTo('.invites', '.wrapper').hide();

        //Footer
        $('.invites', '.wrapper').append('<div class="divider"></div><div class="important"><center>SteamGifts Plus Alternative ' + addon['version'] + ' &copy; 2012-2013 <a href="http://www.steamgifts.com/user/kaitlyn">Kaitlyn</a> | &#32; <a href="http://www.steamgifts.com/user/dotazured">dotazured</a> | &#32; <a href="http://www.steamgifts.com/user/leomoty">leomoty</a><br /><a href="http://www.steamgifts.com/forum/GUbDV/steamgifts-plus-alternative/page/' + (configGet('f_newestfirst') ? '31337/' : '1/') + '">View Forum Topic</a></center></div>');

        //Initialize Control Panel.
        controlPanelInit();
    }

    /**
     * Update user awards.
     * @param {boolean} forceUpdate Forces the update.
     */
    function updateAwards(forceUpdate) {
        if (forceUpdate || (configGet('u_awards') && (lscache.get('lastAwardUpdate') == null || lscache.get('lastAwardUpdate') < now - 3600000))) {
            lscache.set('lastAwardUpdate', now);
            window.addEventListener('message', postMessageReceived, false);

            var scriptAwards = document.createElement('script');
            scriptAwards.type = 'text/javascript';
            scriptAwards.src = 'http://github.com/sgplus-alternative/release/raw/master/awards.js';
            document.head.appendChild(scriptAwards);
        }
    }

    /**
     * Update user wishlist.
     * @param {boolean} forceUpdate Forces the update.
     */
    function updateWishlist(forceUpdate) {
        if (user['loggedIn'] && (forceUpdate || (lscache.get('lastWishlistUpdate') == null || lscache.get('lastWishlistUpdate') < now - 3600000))) {
            lscache.set('lastWishlistUpdate', now);

            var syncData;

            if (page['section'] == 'sync') {
                updateWishlistData($('body'));
            } else {
                $.get('http://www.steamgifts.com/sync', {}, function(data) {
                    syncData = $(data);
                }).complete(function() {
                    updateWishlistData($(syncData));
                });
            }
        }
    }

    /**
     * Update wishlist with sync page data.
     * @param {object} data The page data.
     */
    function updateWishlistData(data) {
        if (data == null || data == '' || !data.find('.heading:contains(Top Games in Your Wishlist)').length) {
            return;
        }

        var wishlist = {};

        $('div.code', data).each(function() {
            if ($(this).text().match(/^\d+\. /)) {
                wishlist[$(this).text().replace(/^\d+\. /, '')] = '';
            }
        });

        lscache.set('giveawayWishlist', wishlist);

        filterGiveaways($('body'));
    }

    /**
     * Update user library.
     * @param {boolean} forceUpdate Forces the update.
     */
    function updateLibrary(forceUpdate) {
        if (user['loggedIn'] && (forceUpdate || (lscache.get('lastLibraryUpdate') == null || lscache.get('lastLibraryUpdate') < now - 3600000))) {
            lscache.set('lastLibraryUpdate', now);

            var syncData;

            if (page['section'] == 'sync') {
                updateLibraryData($('body'));
            } else {
                $.get('http://www.steamgifts.com/sync', {}, function(data) {
                    syncData = $(data);
                }).complete(function() {
                    updateLibraryData($(syncData));
                });
            }
        }
    }

    /**
     * Update wishlist with sync page data.
     * @param {object} data The page data.
     */
    function updateLibraryData(data) {
        if (data == null || data == '' || !data.find('.heading:contains(Games in Your Account)').length) {
            return;
        }

        //retrieve from disk
        giveawayFilters = lscache.get('giveawayFilters');
        if (giveawayFilters == null) {
            giveawayFilters = {};
        }

        //Legacy support. Convert library filters to new format.

        //get property
        var giveawayLibraryFilters = giveawayFilters['libraryFilters'];
        if (giveawayLibraryFilters == null) {
            giveawayLibraryFilters = {};
            giveawayFilters['libraryFilters'] = giveawayLibraryFilters;
        }

        //for each entry in the library
            //if it's a property of giveawayFilters
                //make it a property of giveawayLibraryFilters
                //delete the property from giveawayFilters
        for (var key in giveawayFilters) {
            if (giveawayFilters[key] && key != 'libraryFilters') {
                giveawayLibraryFilters[key] = true;
                delete giveawayFilters[key];
            }
        }

        var gamesList = [];

        //for each "code" div
            //get the text it contains
            //if the entry doesn't exist in giveawayLibraryFilters
                //set it as a property
                //add it to the SGP html stuff
        data.find('div.code').each(function() {
            var name = $(this).text();

            if (name.length && !giveawayLibraryFilters.hasOwnProperty(name)) {
                giveawayLibraryFilters[name] = true;
                $('#sgpFilteredGamesListLibraryEnabled').prepend('<div class="sgpFilteredGame"><span>' + name + '</span><a class="sgpRemoveListItem" href=""><img style="margin-bottom: -2px; width: 12px; height: 12px;" src="http://www.steamgifts.com/img/verify_error.png" title="Remove"></a></div>');
            }

            gamesList.push(name);

            if ($(this).parent().hasClass('last')) {
                return false;
            }
        });

        //this deals with items removed from the library (like after free weekends)
        //for each entry in giveawayLibraryFilters
            //if the entry is not in the games list
                //delete the entry
        for (var key in giveawayLibraryFilters) {
            if (inArray(key, gamesList) == -1) {
                delete giveawayLibraryFilters[key];
            }
        }

        giveawayFilters['libraryFilters'] = giveawayLibraryFilters;

        lscache.set('giveawayFilters', giveawayFilters);

        filterGiveaways($('body'));
    }

    /**
     * Update DLC list.
     * @param {boolean} forceUpdate Forces the update.
     */
    function updateDLC(forceUpdate) {
        if (forceUpdate || (lscache.get('lastDLCUpdate') == null || lscache.get('lastDLCUpdate') < now - (3600000 * 6))) {
            lscache.set('lastDLCUpdate', now);

            window.addEventListener('message', postMessageReceived, false);

            var scriptDLC = document.createElement('script');
            scriptDLC.type = 'text/javascript';
            scriptDLC.src = 'http://htmlpreview.github.io/?https://github.com/psyren89/release/blob/master/dlc.min.js';
            document.head.appendChild(scriptDLC);
        }
    }

    /**
     * Update notification.
     */
    function notifyUpdate(forceUpdate) {
        if (configGet('ge_notifyupdate')) {
            var notifyUpdatePrompt = confirm('SteamGifts Plus has updated to version ' + addon['version'] + ', would you like to view the changelog?');
            if (notifyUpdatePrompt) {
                $('<div id="sgpOverlayBG"></div>').appendTo('body').fadeIn('slow');
                $('body').append('<div class="sgpOverlay" style="width: 800px; height: 500px; margin-left:-400px; margin-top: -250px;"><iframe style="width: 795px; height:495px; background-color: #FFFFFF; padding: 5px;" frameborder="0" src="http://github.com/sgplus-alternative/release/raw/master/changelog.txt"></iframe></div>');
            }
        }
    }

    /**
     * Initialize the config.
     */
    function configInit() {
        var configLoaded = lscache.get('config');
        if (configLoaded != null) {
            configCache = configLoaded;
        } else {
            configCache = {};
            for (var key in config) {
                //Legacy config support.
                var value = lscache.get(key);
                if (value != null) {
                    configCache[key] = value;
                    lscache.remove(key);
                } else {
                    configCache[key] = config[key];
                }
            }
            lscache.set('config', configCache);
        }
    }

    /**
     * Gets the config value. Returns the default config value if the config was not in localStorage.
     * @param {string} name The config value to get.
     * @return {*} The config value.
     */
    function configGet(name) {
        if (configCache.hasOwnProperty(name)) {
            return configCache[name];
        } else {
            configCache[name] = config[name];
            lscache.set('config', configCache);
            return config[name];
        }
    }

    /**
     * Sets the config value.
     * @param {string} name The config name to set.
     * @param {*} value The config value to set.
     */
    function configSet(name, value) {
        configCache[name] = value;
        lscache.set('config', configCache);
    }

    /**
     * postMessage received. Do stuff with the data.
     * @param {Object} event Message event object.
     */
    function postMessageReceived(event) {
        if (event.data.awards != null) {
            lscache.set('userAwards', event.data.awards);
        } else if (event.data.dlc != null) {
            var DLCList = event.data.dlc;
            lscache.set('DLC', DLCList);
        }
    }

    /**
     * Remaining localStorage space in bytes.
     * @return {number} The remaining localStorage space in bytes.
     */
    function localStorageRemainingSpace() {
        return 1024 * 1024 * 5 - unescape(encodeURIComponent(JSON.stringify(localStorage))).length;
    }

    /**
     * jQuery 1.5.2 inArray 'fix' (1.7.2 code)
     * @param {string} elem The string to search for in the array.
     * @param {Array} array The array to search in.
     * @param {number} i The starting index for the search.
     * @return {number} The index of the found string, or -1 if none.
     */
    function inArray(elem, array, bSearch) {
        var len;
        if (array) {
            if (bSearch) {
                return binarySearch(elem, array);
            }
            indexOf = Array.prototype.indexOf;
            if (indexOf) {
                return indexOf.call(array, elem, i);
            }
            len = array.length;
            for (var i = 0; i < len; i++) {
                if (array[i] === elem) return i;
            }
        }
        return -1;
    };

    /**
     * Get a URL paramater.
     * @param {string} name The URL paramater to get.
     * @return {string} The paramatar value. Returns null if no value.
     */
    function getURLParameter(name) {
        return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [, ""])[1].replace(/\+/g, '%20')) || null;
    }

    /**
     * Checks if the element is in sight. Credit: Steve Sobel (Reddit Enhancement Suite http://redditenhancementsuite.com/).
     * @param {Object} The element to check for.
     * @return {boolean} Returns true if the element was in sight.
     */
    function elementInSight(obj) {
        if (obj == null) {
            return;
        }

        var top = obj.offsetTop;
        var left = obj.offsetLeft;
        var width = obj.offsetWidth / 4;
        var height = obj.offsetHeight / 4;

        while (obj.offsetParent) {
            obj = obj.offsetParent;
            top += obj.offsetTop;
            left += obj.offsetLeft;
        }

        return top >= window.pageYOffset &&
            left >= window.pageXOffset &&
            (top + height) <= (window.pageYOffset + window.innerHeight) &&
            (left + width) <= (window.pageXOffset + window.innerWidth);
    }

    /**
     * Bind window scroll event. Check if we need to load the next page if endless scrolling is on etc.
     */
    $(window).bind('scroll', function() {
        endlessScrollingCheck();

        if (configGet('ge_floatdown_menu')) {
            if (!sgpFloatDownMenuOn && window.pageYOffset > 90) {
                sgpFloatDownMenuOn = true;
                $('.sgpFloatDownMenu').slideDown(function() {
                    $('.sgpFloatDownMenu ol').show();
                });
            } else if (sgpFloatDownMenuOn && window.pageYOffset < 90) {
                $('.sgpFloatDownMenu ol').hide();
                $('.sgpFloatDownMenu').slideUp();
                sgpFloatDownMenuOn = false;
            }
        }
    });

    /**
     * Check if we have to load the next page.
     */
    function endlessScrollingCheck() {
        if (!giveawayFilteringDone) {
            return;
        }
        if (pageContent == null && !pageLoading && elementInSight(document.getElementById('sgpNextPageLoading'))) {
            if (configGet('f_endlessscrolling') && page['section'] == 'forum') {
                pageLoading = true;
                if (locationURI.length > 4 && page['id'].length == 5) {
                    //Forum topic.      
                    page['number'] += (configGet('f_newestfirst')) ? -1 : 1;

                    $.get('http://www.steamgifts.com/forum/' + page['id'] + '/' + page['name'] + '/page/' + page['number'], function(data) {
                        sgpPageLoaded(data);
                    });
                } else {
                    //Forum index.
                    page['number'] += 1;
                    var searchPage = '';
                    if (page['id'] == 'search') {
                        searchPage = locationURI[4] + '/page/'
                    }
                    if (page['id'] == 'id') {
                        page['id'] = 'page';
                    }

                    $.get('http://www.steamgifts.com/forum/' + page['id'] + '/' + searchPage + page['number'], function(data) {
                        sgpPageLoaded(data);
                    });
                }
            } else if (configGet('gi_endlessscrolling') && (page['section'] == 'new' || page['section'] == 'closed' || page['section'] == 'coming-soon' || page['section'] == '' || page['section'] == 'open')) {
                //Giveaway index / home.
                if (page['section'] == '') {
                    page['section'] = 'open';
                }
                pageLoading = true;
                page['number'] += 1;

                $.get('http://www.steamgifts.com/' + page['section'] + '/page/' + page['number'], function(data) {
                    sgpPageLoaded(data);
                });
            }
        } else if (elementInSight(document.getElementById('sgpNextPageLoading')) && giveawayFilteringDone && pageContent != null && !pageAdding && !pageAddingPaused) {
            sgpAddpageContent();
        } else if (pageContent != null && giveawayFilteringDone && !pageAdding && !pageAddingPaused) {
            pageAddingPaused = true;
            $('#sgpNextPageLoading').hide();
            $('#sgpNextPageLoading').after('<center><a style="color: #347DB5;" href="" id="sgpResumeLoading">Resume loading next page...</a></center>');
        }
    }
    $('#sgpResumeLoading').live('click', function() {
        pageAddingPaused = false;
        $('#sgpNextPageLoading').show();
        $(this).parent().remove();
        endlessScrollingCheck();
        return false;
    });


    /**
     * Whenever one of our option checkboxes changes.
     */
    $('.sgpCheckbox').live('click', function() {
        if ($(this).hasClass('disabled')) {
            return false;
        }

        var key = $(this).attr('id');
        var value = $(this).hasClass('checked');
        configSet(key, !value);

        //Set all duplicate checkboxes to the same value.
        if (value) {
            $('.sgpCheckbox#' + key).removeClass('checked');
        } else {
            $('.sgpCheckbox#' + key).addClass('checked');
        }

        //Special things to do for certain checkboxes.
        switch (key) {
            case 'f_newestfirst':
                $('.parent_container').reverse().appendTo('.comment_container');
                if (!value) {
                    $('div#comment_form').insertBefore('.comment_container');
                } else {
                    $('div#comment_form').insertAfter('.comment_container');
                }
                $('div#comment_location').insertBefore('div#comment_form');
                break;
            case 'f_endlessscrolling':
            case 'gi_endlessscrolling':
                $('.sgpRowPage:first, .sgpRowPage:last, .pagination:first, .pagination:last').toggle();
                if (!value) {
                    $('#' + key + '_seamless').removeClass('disabled');
                    $('#sgpPaddingControls').prependTo('.sgpDisplayControls:last');
                } else {
                    $('#' + key + '_seamless').addClass('disabled');
                    $('#sgpPaddingControls').prependTo('.sgpDisplayControls:first');
                }
                pageLoading = false;
                break;
            case 'gi_gridview':
                //Grid view.
                var giveaways = $('.ajax_gifts .post, .content>.post>div');
                if (!value) {
                    giveaways.css({
                        'display': 'inline-block',
                        'padding': '0',
                        'border-top': 'none',
                        'border-bottom': 'none'
                    });
                    giveaways.find('.left, .center').hide();
                    giveaways.find('.sgpTileViewTimeleft, .sgpTileViewCopies, .sgpTileViewContributor').show();
                } else {
                    var postPadding = configGet('ge_postpadding');
                    $('.post:not(.post[style*="227, 236, 245"]):not(.post[style*="#E3ECF5"])').css('padding', postPadding + 'px 0');
                    $('.post[style*="227, 236, 245"], .post[style*="#E3ECF5"]').css('padding', postPadding + 'px 15px 0px 15px');
                    giveaways.css({
                        'display': 'inherit',
                        'border-top': '1px solid #FFFFFF',
                        'border-bottom': '1px dotted #C3C3C3'
                    });
                    giveaways.find('.left, .center').show();
                    giveaways.find('.sgpTileViewTimeleft, .sgpTileViewCopies, .sgpTileViewContributor').hide();
                }
                break;
            case 'ge_be_bettereditor':
                if (!value) {
                    $('#ge_be_livepreview, #ge_be_formatbuttons, #ge_be_newlineparse').removeClass('disabled');
                } else {
                    $('#ge_be_livepreview, #ge_be_formatbuttons, #ge_be_newlineparse').addClass('disabled');
                }
                break;
            case 'gi_hidefeatured':
                if (!value) {
                    $('#gi_replacefeatured').removeClass('disabled');
                } else {
                    $('#gi_replacefeatured').addClass('disabled');
                }
                break;
            case 'gi_f_entrylimit_enabled':
                if (!value) {
                    $('#gi_f_entrylimit_value').attr('disabled', false);
                } else {
                    $('#gi_f_entrylimit_value').attr('disabled', true);
                }
                break;
        }

        filterGiveaways($('body'));
    });

    /**
     * Remove list items.
     */
    $(".sgpIgnoredUser, .sgpFilteredGame, .sgpTaggedUser").live('mouseover', function() {
        $(this).find('img').css('opacity', '1');
    });

    $(".sgpIgnoredUser, .sgpFilteredGame, .sgpTaggedUser").live('mouseout', function() {
        $(this).find('img').css('opacity', '0.2');
    });

    $("a.sgpRemoveListItem").live('mouseover', function() {
        if ($(this).hasClass('LibraryDisabled')) {
            $(this).parent().addClass('sgpListItemGreen');
            $(this).parent().children().addClass('sgpRemoveListItemGreen');
        } else {
            $(this).parent().addClass('sgpListItemRed');
            $(this).parent().children().addClass('sgpRemoveListItemRed');
        }
    });

    $("a.sgpRemoveListItem").live('mouseout', function() {
        if ($(this).hasClass('LibraryDisabled')) {
            $(this).parent().removeClass('sgpListItemGreen');
            $(this).parent().children().removeClass('sgpRemoveListItemGreen');
        } else {
            $(this).parent().removeClass('sgpListItemRed');
            $(this).parent().children().removeClass('sgpRemoveListItemRed');
        }
    });

    $('a.sgpRemoveListItem').live('click', function() {
        $('span.error, span.success').remove();
        var name = $(this).parent().find('span:first').text();
        if ($(this).parent().hasClass('sgpFilteredGame')) {
            giveawayFilters = lscache.get('giveawayFilters');
            if (giveawayFilters == null) {
                giveawayFilters = {};
            }

            var giveawayLibraryFilters = giveawayFilters['libraryFilters'];
            if (giveawayLibraryFilters == null) {
                giveawayLibraryFilters = {};
                giveawayFilters['libraryFilters'] = giveawayLibraryFilters;
            }

            if ($(this).hasClass('LibraryEnabled')) {
                giveawayFilters['libraryFilters'][name] = false;
                $('#sgpFilteredGamesListLibraryDisabled').prepend('<div class="sgpFilteredGame"><span>' + name + '</span><a class="sgpRemoveListItem LibraryDisabled" href=""><img style="margin-bottom: -2px; width: 12px; height: 12px;" src="http://www.steamgifts.com/img/verify_success.png" title="Enable"></a></div>');
            } else if ($(this).hasClass('LibraryDisabled')) {
                giveawayFilters['libraryFilters'][name] = true;
                $('#sgpFilteredGamesListLibraryEnabled').prepend('<div class="sgpFilteredGame"><span>' + name + '</span><a class="sgpRemoveListItem LibraryEnabled" href=""><img style="margin-bottom: -2px; width: 12px; height: 12px;" src="http://www.steamgifts.com/img/verify_error.png" title="Disable"></a></div>');
            } else {
                delete giveawayFilters[name];
            }

            lscache.set('giveawayFilters', giveawayFilters);
        } else if ($(this).parent().hasClass('sgpIgnoredUser')) {
            unignoreUser(name);
        } else if ($(this).parent().hasClass('sgpTaggedUser')) {
            usertagRemove(name);
        }

        $(this).parent().fadeOut('slow', function() {
            $(this).remove();
        });

        return false;
    });

    /**
     * User profile ignore add/remove.
     */
    $('#sgpIgnoreAdd').live('click', function() {
        ignoreUser($(this).attr('name'));

        $('img', 'div.avatar').css('opacity', '0.1');
        $('div.avatar').css('background-image', 'url(' + image["userIgnoredAvatar"] + ')');
        $('.details .heading').find('strong:first').css('color', '#dd7070');

        $(this).text('Unignore');
        $(this).attr('id', 'sgpIgnoreRemove');

        return false;
    });

    $('#sgpIgnoreRemove').live('click', function() {
        unignoreUser($(this).attr('name'));

        $('img', 'div.avatar').css('opacity', '1.0');
        $('div.avatar').css('background-image', '');
        $('.details .heading').find('strong:first').css('color', '');

        $(this).text('Ignore');
        $(this).attr('id', 'sgpIgnoreAdd');

        return false;
    });

    /**
     * Ignore a user.
     * @param {string} Username of the user.
     */
    function ignoreUser(username) {
        ignoredUsers = lscache.get('ignoredUsers');
        if (ignoredUsers == null) {
            ignoredUsers = {};
        }
        username.trim();

        if (!ignoredUsers.hasOwnProperty(username) && inArray(username.toLowerCase(), staff) == -1 && username != user['username']) {
            ignoredUsers[username] = '';

            lscache.set('ignoredUsers', ignoredUsers);
        }
    }

    /**
     * Unignore a user.
     * @param {string} Username of the user.
     */
    function unignoreUser(username) {
        ignoredUsers = lscache.get('ignoredUsers');
        if (ignoredUsers == null) {
            ignoredUsers = {};
        }
        delete ignoredUsers[username];
        lscache.set('ignoredUsers', ignoredUsers);


    }

    /**
     * Set a user's usertag.
     * @param {string} Username of the user.
     * @param {string} The desired usertag.
     * @param {string} Color of the usertag.
     */
    function usertagAdd(username, usertag, color) {
        usertags = lscache.get('usertags');
        if (usertags == null) {
            usertags = {};
        }

        username.trim();
        usertag.trim();
        color.trim();

        usertags[username] = {
            'usertag': usertag,
            'color': color
        };

        lscache.set('usertags', usertags);

        if (page['section'] == 'user') {
            $('#sgpTagUser').remove();
            $('.sgpProfileUsertag').prepend('<a id="sgpTagUser" href="" style="text-shadow: -1px -1px #1D5380; color:' + color + '; text-decoration: none;">' + usertag + ' <img title="Tag User" src="' + image['usertag'] + '" style="margin-top: -5px; position: relative; top: 3px;"></a>');
        } else if (page['section'] != 'steamgiftsplus') {
            $('.comment.parent:contains(' + username + '), .comment.child:contains(' + username + ')').each(function() {
                var posterUsername = $(this).find('.author_name').children('a:first').text();

                if (posterUsername == username) {
                    $(this).find('.spgUsertag').replaceWith(' <span class="spgUsertag" style="color: ' + color + '; font-weight: bold;">' + usertag + '</span>');
                }
            });

            var topicCreator = $('.author>p>a:last').text();
            if (topicCreator == username) {
                $('.author>p>span:last').remove();
                $('.author>p>a:last').after(' <span style="color:' + color + '; font-weight:bold;">' + usertag + '</span>');
            }

            $('.sgpOverlay, #sgpOverlayBG').remove();
        }
    }

    /**
     * Delete a user's usertag.
     * @param {string} username Username of the user.
     */
    function usertagRemove(username) {
        usertags = lscache.get('usertags');
        if (usertags == null) {
            usertags = {};
        }
        delete usertags[username];
        lscache.set('usertags', usertags);
    }

    /**
     * Usertags.
     */
    $('a.sgpDropdownTextboxItem').live('click', function() {
        $('input#sgpTaggedUsersAddTag').css('color', $(this).css('color'));
        return false
    });

    $('input[type="text"]', '#sgpProfileTagForm').keypress(function(event) {
        if (event.which == 13) {
            usertagAdd($('#sgpProfileTagForm').attr('name'), $(this).val(), $(this).css('color'));
        }
    });

    $('#sgpTagUserAdd').live('click', function() {
        usertagAdd($('#sgpProfileTagForm').attr('name'), $('#sgpTaggedUsersAddTag').val(), $('#sgpTaggedUsersAddTag').css('color'));
        return false;
    });

    $('#sgpTagUserRemove').live('click', function() {
        var username = $('#sgpProfileTagForm').attr('name');
        usertagRemove(username);

        if (page['section'] == 'user') {
            $('#sgpTagUser').remove();
            $('.details .heading').find('strong:first').parent().append('<a id="sgpTagUser" href=""><img title="Tag User" src="' + image["usertag"] + '"></a>');
        } else {
            $('.comment.parent:contains(' + username + '), .comment.child:contains(' + username + ')').each(function() {
                var posterUsername = $(this).find('.author_name').children('a:first').text();

                if (posterUsername == username) {
                    $(this).find('.spgUsertag').replaceWith('<span class="spgUsertag"></span>');
                }
            });

            $('.sgpOverlay, #sgpOverlayBG').remove();
        }
        return false;
    });

    $('#sgpTagUserCancel').live('click', function() {
        $('.sgpOverlay, #sgpOverlayBG').remove();
        return false;
    });

    /**
     * Control Panel usertagging.
     */
    $('#usertagAdd').live('click', function() {
        $('span.error, span.success').remove();

        var username = $('#sgpTaggedUsersAddUsername').val().trim();
        var usertag = $('#sgpTaggedUsersAddTag').val().trim();
        var color = $('#sgpTaggedUsersAddTag').css('color');

        if (username.length < 1 || username == 'Username to tag. Case Insensitive.') {
            $('.sgpTaggedUsersList').prepend('<span class="error">Please enter a username.<br></span>');
            return false;
        }

        if (usertag.length > 0 && usertag != 'User tag.') {
            var obj;

            $('<span id="sgpWorkingIcon"><center><img src="' + image["loadinggif"] + '" /></center><br></span>').prependTo('.sgpTaggedUsersList').hide().fadeIn('slow');

            $.get('http://www.steamgifts.com/user/' + username, {}, function(data) {
                obj = $(data);
            }).complete(function() {
                $('#sgpWorkingIcon').fadeOut('slow', function() {
                    $(this).remove();
                });

                if ($('.profile', obj).length) {
                    var validUsername = $('.details .heading', obj).find('strong:first').text();

                    usertagAdd(validUsername, usertag, color);

                    $('<div class="sgpTaggedUser" name="' + validUsername + '"><a href="http://www.steamgifts.com/user/' + validUsername + '"><span>' + validUsername + '</span></a> <span style="color:' + color + '; font-weight:bold;">' + usertag + '</span><a class="sgpRemoveListItem" href=""><img style="margin-bottom: -2px; width: 12px; height: 12px;" src="http://www.steamgifts.com/img/verify_error.png" title="Remove"></a></div>').prependTo('.sgpTaggedUsersList');
                    $('.sgpTaggedUsersList').prepend('<span class="success">Successfully tagged <strong><span>' + validUsername + '</span></strong> as <span class="usertag" style="color:' + color + ';">' + usertag + '</span><br></span>');

                    return false;
                } else {
                    $('.sgpTaggedUsersList').prepend('<span class="error">Cannot find user "' + username + '".<br></span>');
                    return false;
                }
            }).error(function() {
                $('#sgpWorkingIcon').fadeOut('slow', function() {
                    $(this).remove();
                });
                $('.sgpTaggedUsersList').prepend('<span class="error">Cannot find user "' + username + '".<br></span>');
                return false;
            });
        } else {
            $('.sgpTaggedUsersList').prepend('<span class="error">Please enter a user tag.<br></span>');
        }
        return false;
    });

    /**
     * Control Panel ignoring.
     */
    $('#ignoreUserAdd').live('click', function() {
        $('span.error, span.success').remove();

        var username = $('#sgpIgnoredUsersAddUsername').val().trim();

        if (username.length < 1 || username == 'Username to tag. Case Insensitive.') {
            $('.sgpIgnoredUsersList').prepend('<span class="error">Please enter a username.<br></span>');
            return false;
        }

        $('<span id="sgpWorkingIcon"><center><img src="' + image["loadinggif"] + '" /></center><br></span>').prependTo('.sgpIgnoredUsersList').hide().fadeIn('slow');

        var obj;

        $.get('http://www.steamgifts.com/user/' + username, {}, function(data) {
            obj = $(data);
        }).complete(function() {
            $('#sgpWorkingIcon').fadeOut('slow', function() {
                $(this).remove();
            });

            if ($('.profile', obj).length) {
                var validUsername = $('.details .heading', obj).find('strong:first').text();

                if (validUsername == user['username']) {
                    $('.sgpIgnoredUsersList').prepend('<span class="error">You cannot ignore yourself.<br></span>');
                    return false;
                } else if (inArray(validUsername.toLowerCase(), staff) >= 0) {
                    $('.sgpIgnoredUsersList').prepend('<span class="error">You cannot ignore SteamGifts staff.<br></span>');
                    return false;
                }
                ignoreUser(validUsername);

                $('<div class="sgpIgnoredUser" name="' + validUsername + '"><a href="http://www.steamgifts.com/user/' + validUsername + '"><span>' + validUsername + '</span></a><a class="sgpRemoveListItem" href=""><img style="margin-bottom: -2px; width: 12px; height: 12px;" src="http://www.steamgifts.com/img/verify_error.png" title="Remove"></a></div>').prependTo('.sgpIgnoredUsersList');
                $('.sgpIgnoredUsersList').prepend('<span class="success">Successfully ignored <strong>' + validUsername + '</strong><br></span>');

                return false;
            } else {
                $('#sgpWorkingIcon').fadeOut('slow', function() {
                    $(this).remove();
                });
                $('.sgpIgnoredUsersList').prepend('<span class="error">Cannot find user "' + username + '".<br></span>');
                return false;
            }
        }).error(function() {
            $('.sgpIgnoredUsersList').prepend('<span class="error">Cannot find user "' + username + '".<br></span>');
            return false;
        });
        return false;
    });

    /**
     * Default input text value.
     */
    $('input[type="text"].sgpInput').live('click', function() {
        if ($(this).val() == $(this).attr('name')) {
            $(this).val('');
        }
    });

    $('input[type="text"].sgpInput').live('blur', function() {
        if ($(this).val() == '') {
            $(this).val($(this).attr('name'));
        }
    });

    /**
     * Giveaway search.
     */
    $('#sgpSearchGiveawaysInput').live('keypress', function(event) {
        if (event.which == 13 && $(this).val().trim() != 'Search giveaways...') {
            giveawaySearch = $(this).val().trim();
            filterGiveaways($('body'));
        }
    });

    $('#sgpSearchGiveawaysInput').live('blur', function() {
        if ($(this).val().trim() != 'Search giveaways...') {
            giveawaySearch = $(this).val().trim();
            filterGiveaways($('body'));
        }
    });

    $('#sgpSearchGiveawaysCancel').live('click', function() {
        giveawaySearch = '';
        $('#sgpSearchGiveawaysInput').val('Search giveaways...');
        filterGiveaways($('body'));
        return false;
    });

    /**
     * Filter control inout text boxes.
     */
    $('input[type="text"].sgpFilterInput').live('blur', function() {
        filterControlText($(this));
    });

    $('input[type="text"].sgpFilterInput').live('keypress', function(event) {
        if (event.which == 13) {
            filterControlText($(this));
        }
    });

    function filterControlText(obj) {
        var value = obj.val();
        switch (obj.attr('id')) {
            case 'gi_f_entrylimit_value':
                configSet('gi_f_entrylimit_value', parseInt(value));
                break;
            case 'gi_f_minimumcopies':
                configSet('gi_f_minimumcopies', parseInt(value));
                break;
            case 'gi_f_minimumchance':
                configSet('gi_f_minimumchance', value);
                break;
            case 'gi_f_contributor_value_min':
                if (value < 0) {
                    value = 0;
                } else if (value > 5000) {
                    value = 5000;
                }
                obj.val(value);

                configSet('gi_f_contributor_value_min', value);
                $('#sgpContributorValueRangeSlider').slider({
                    values: [parseFloat(value).toFixed(2), parseFloat(configGet('gi_f_contributor_value_max')).toFixed(2)]
                });
                break;
            case 'gi_f_contributor_value_max':
                if (value < 0) {
                    value = 0;
                } else if (value > 5000) {
                    value = 5000;
                }
                obj.val(value);

                configSet('gi_f_contributor_value_max', value);
                $('#sgpContributorValueRangeSlider').slider({
                    values: [parseFloat(configGet('gi_f_contributor_value_min')).toFixed(2), parseFloat(value).toFixed(2)]
                });
                break;
        }
        filterGiveaways($('body'));
    }

    /**
     * Dropdown textbox fix for new elements. Credit: cg's code.
     */
    $('.absolute_dropdown .heading, .sgpDropdownTextboxAbsolute .sgpDropdownTextboxHeading, .sgpDropdownMenuAbsolute a, .sgpDropdownFilterControlsAbsolute .sgpDropdownFilterControlsHeading').live('click', function() {
        if (!$(this).hasClass('selected')) {
            $('.absolute_dropdown .heading, .sgpDropdownTextboxAbsolute .sgpDropdownTextboxHeading, .sgpDropdownMenuAbsolute a, .sgpDropdownFilterControlsHeading').removeClass('selected');
            $('.absolute_dropdown .items, .sgpDropdownTextboxAbsolute .sgpDropdownTextboxItems, .sgpDropdownMenuAbsolute .sgpDropdownMenuItems, .sgpDropdownFilterControlsAbsolute .sgpDropdownFilterControlsItems').hide();
            $(this).parent().children(".items, .sgpDropdownTextboxItems, .sgpDropdownMenuItems, .sgpDropdownFilterControlsItems").show();
            if ($(this).is('.sgpDropdownFilterControlsHeading')) {
                $('#sgpFilterControlsClose').show();
            }
            $(this).addClass('selected')
        } else {
            $('.absolute_dropdown .heading, .sgpDropdownTextboxAbsolute .sgpDropdownTextboxHeading, .sgpDropdownMenuAbsolute a, .sgpDropdownFilterControlsAbsolute .sgpDropdownFilterControlsHeading').removeClass('selected');
            $('.absolute_dropdown .items, .sgpDropdownTextboxAbsolute .sgpDropdownTextboxItems, .sgpDropdownMenuAbsolute .sgpDropdownMenuItems, .sgpDropdownFilterControlsAbsolute .sgpDropdownFilterControlsItems').hide();
            $('#sgpFilterControlsClose').hide();
        }
        return false;
    });

    $('body').live('click', function() {
        $('.absolute_dropdown .heading, .sgpDropdownTextboxAbsolute .sgpDropdownTextboxHeading, .sgpDropdownMenuAbsolute a').removeClass('selected');
        $('.absolute_dropdown .items, .sgpDropdownTextboxAbsolute .sgpDropdownTextboxItems, .sgpDropdownMenuAbsolute .sgpDropdownMenuItems').hide();
    });

    $('#sgpFilterControlsClose').live('click', function() {
        $('.absolute_dropdown .heading, .sgpDropdownTextboxAbsolute .sgpDropdownTextboxHeading, .sgpDropdownMenuAbsolute a, .sgpDropdownFilterControlsAbsolute .sgpDropdownFilterControlsHeading').removeClass('selected');
        $('.absolute_dropdown .items, .sgpDropdownTextboxAbsolute .sgpDropdownTextboxItems, .sgpDropdownMenuAbsolute .sgpDropdownMenuItems, .sgpDropdownFilterControlsAbsolute .sgpDropdownFilterControlsItems').hide();
        $('#sgpFilterControlsClose').hide();
    });

    $('.absolute_dropdown, .sgpDropdownTextboxAbsolute, .sgpDropdownMenuAbsolute').live('click', function(event) {
        event.stopPropagation();
    });


    /**
     * Toggle ignored comments.
     */
    $('.sgpToggleIgnoredComment').live('click', function() {
        var comment = $(this).parents('.body_container:first').find('.comment_body.markdown');

        if (comment.is(":hidden")) {
            $(this).parents('.comment.parent:first, .comment.child:first').css('opacity', '1.0');
            $(this).text('Hide Comment');
        } else {
            $(this).parents('.comment.parent:first, .comment.child:first').css('opacity', '0.6');
            $(this).text('Show Comment');
        }

        comment.slideToggle();

        return false;
    });

    /**
     * Comment linking on click highlight.
     */
    $('.sgpCommentLink').live('click', function() {
        //Remove any old highlights.
        $('.body_container').removeClass('sgpCommentLinkedTo');
        $('.child_container').removeClass('sgpCommentLinkedTo');
        $('.sgpCommentLink').removeClass('sgpCommentLinkSelected');

        //Highlight this comment.
        if ($(this).parent().parent().parent().is('.comment.child')) {
            $(this).parents('.child_container:first').addClass('sgpCommentLinkedTo');
        } else {
            $(this).parents('.body_container:first').addClass('sgpCommentLinkedTo');
        }
        $(this).addClass('sgpCommentLinkSelected');

        var offset = 20;
        if (sgpFloatDownMenuOn) {
            offset = 90;
        }
        $('html,body').animate({
            scrollTop: $(this).offset().top - offset
        });
    });

    /**
     * User menu ignoring.
     */
    $('#sgpDropdownMenuIgnore').live('click', function() {
        var username = $(this).attr('name');

        ignoreUser(username);

        $('.comment.parent:contains(' + username + '), .comment.child:contains(' + username + ')').each(function() {
            var comment = $(this);
            var posterUsername = comment.find('.author_name>a:first').text();

            if (posterUsername == username) {
                comment.find('.author_name>a:first').css('color', '#DD7070');
                comment.find('.comment_body.markdown').hide();
                comment.find('.avatar_container').hide();
                comment.css('opacity', '0.6');

                if (comment.is('.comment.parent')) {
                    comment.find('.body_container').css('width', '990px');
                    comment.find('.author_name').append(' <div style="color:#DD7070; font-weight:bold;">Comment by ignored user. <a class="sgpToggleIgnoredComment" href="">Show Comment</a></div>');
                } else {
                    comment.find('.author_container').css('width', '310px');
                    comment.find('.user_body').prepend(' <div style="color:#DD7070; font-weight:bold;">Comment by ignored user. <a class="sgpToggleIgnoredComment" href="" style="color:#4F565A; font-weight:bold;">Show Comment</a></div>');
                }

                //User menu change.
                comment.find('.sgpDropdownMenuAbsolute:first .sgpDropdownMenuItem:contains(Ignore User)').replaceWith('<div class="sgpDropdownMenuItem"><a id="sgpDropdownMenuUnignore" style="color:#DD7070;" name="' + username + '" href=""><img src="' + image['ignore'] + '" style="margin-left: -1px;"> Unignore User</a></div>');
            }
        });

        return false;
    });

    $('#sgpDropdownMenuUnignore').live('click', function() {
        var username = $(this).attr('name');

        unignoreUser(username);

        $('.comment.parent:contains(' + username + '), .comment.child:contains(' + username + ')').each(function() {
            var comment = $(this);
            var posterUsername = comment.find('.author_name>a:first').text();

            if (posterUsername == username) {
                comment.find('.author_name>a:first').css('color', '');
                comment.find('.comment_body.markdown').show();
                comment.find('.avatar_container').show();
                comment.css('opacity', '1.0');
                comment.find('div[style*="color:#DD7070;"]').remove();

                if (comment.is('.comment.parent')) {
                    comment.find('.body_container').css('width', '900px');
                } else {
                    comment.find('.author_container').css('width', '350px');
                }

                //User menu change.
                comment.find('.sgpDropdownMenuAbsolute:first .sgpDropdownMenuItem:contains(Unignore User)').replaceWith('<div class="sgpDropdownMenuItem"><a id="sgpDropdownMenuIgnore" style="color:#DD7070;" name="' + username + '" href=""><img src="' + image['ignore'] + '" style="margin-left: -1px;"> Ignore User</a></div>');
            }
        });

        return false;
    });

    /**
     * User menu tagging.
     */
    $('#sgpDropdownMenuLink').live('click', function() {
        window.location = $(this).attr('href');
        return true;
    });

    $('#sgpDropdownMenuUsertag').live('click', function() {
        $('<div id="sgpOverlayBG"></div>').appendTo('body').fadeIn('slow');
        $('body').append('<div class="sgpOverlay" style="width:300px; margin-left:-150px"><strong style="padding-left: 5px;">' + $(this).attr("name") + '</strong><div class="clear_both"></div><div id="sgpProfileTagForm" name="' + $(this).attr("name") + '"><div class="sgpDropdownTextboxRelative"><div class="sgpDropdownTextboxAbsolute"><div class="sgpDropdownTextboxHeading" style="top:14px; margin-left:278px;"><a href=""><img src=http://www.steamgifts.com/img/dropdown_arrow.png /></a></div><div class="sgpDropdownTextboxItems" style="display: none; width:286px; margin-top:-7px; margin-left:0;"><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:#8BBA65;" href="" class="sgpDropdownTextboxItem">Green</a></div><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:#dd7070;" href="" class="sgpDropdownTextboxItem">Red</a></div><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:#579AD4;" href="" class="sgpDropdownTextboxItem">Blue</a></div><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:#A85ACF;" href="" class="sgpDropdownTextboxItem">Purple</a></div><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:#F67FFF;" href="" class="sgpDropdownTextboxItem">Pink</a></div><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:#FF8A00;" href="" class="sgpDropdownTextboxItem">Orange</a></div><div class="sgpDropdownTextboxItem" style="cursor:pointer;"><a style="color:inherit;" href="" class="sgpDropdownTextboxItem">Default</a></div></div></div></div> <input type="text" class="sgpInput" id="sgpTaggedUsersAddTag" name="User tag." value="User tag." maxlength="40" style="width:288px; z-index:35; position:relative;">\
      <div class="clear_both"></div><a style="margin-top:5px; color:#FFFFFF;" class="sgpAddListItem" id="sgpTagUserAdd" href="">Set Tag</a> <a style="margin-top:5px; color:#FFFFFF;" class="sgpAddListItem" id="sgpTagUserRemove" href="">Remove Tag</a> or <a id="sgpTagUserCancel" href="">cancel.</a> <div class="clear_both"></div></div></div>');
    });

    /**
     * Overlay background.
     */
    $('#sgpOverlayBG').live('click', function() {
        $(this).remove();

        if ($('.sgpOverlay').find('#gi_f_enabled').length) {
            filterGiveaways($('body'));
        }

        $('.ajax_gifts>div.post.quickview').removeClass('quickview');

        $('.sgpOverlay').remove();
    });

    /**
     * New comment navigation.
     */
    $('.sgpCommentGotoNext, .sgpCommentGotoNextNotifcation').live('click', function() {
        var nextCommentId = parseInt($(this).attr('name').replace(/\D/g, '')) + 1;
        var nextComment = $('#sgpNew' + nextCommentId);
        var offset = 20;
        if (sgpFloatDownMenuOn) {
            offset = 90;
        }
        if (nextComment.length) {
            $('html,body').animate({
                scrollTop: nextComment.offset().top - offset
            });
        }
        return false;
    });

    $('.sgpCommentGotoPrev').live('click', function() {
        var prevCommentId = parseInt($(this).attr('name').replace(/\D/g, '')) - 1;
        var PrevComment = $('#sgpNew' + prevCommentId);
        var offset = 20;
        if (sgpFloatDownMenuOn) {
            offset = 90;
        }
        if (PrevComment.length) {
            $('html,body').animate({
                scrollTop: PrevComment.offset().top - offset
            });
        }
        return false;
    });

    /**
     * Hover images.
     */
    $('.comment_body.markdown a, .body.markdown a, .body.sgpMarkdown a').live('mousemove', function(event) {
        if ($(this).text().trim().length && configGet('ge_comments_imagehover') && $(this).attr('href').match(/\.(jpg|jpeg|gif|png|bmp)/i)) {
            $('body').append('<img class="sgpImageHover" src="' + $(this).attr('href') + '">');

            var img = $('.sgpImageHover').get(0);

            //if (event.clientY + 20 + img.clientHeight >= window.innerHeight) {
            //  $('.sgpImageHover').css('bottom', '0px');
            //} else {
            $('.sgpImageHover').css('top', event.clientY + 20 + 'px');
            //}

            $('.sgpImageHover').css('max-width', '100%');

            if (event.clientX + 20 + img.clientWidth >= window.innerWidth) {
                $('.sgpImageHover').css('left', (window.innerWidth - img.clientWidth) + 'px');
            } else {
                $('.sgpImageHover').css('left', event.clientX + 20 + 'px');
                $('.sgpImageHover').css('max-width', (window.innerWidth - (event.clientX + 50)) + 'px');
            }
        }
    });

    $('.comment_body.markdown a, .body.markdown a, .body.sgpMarkdown a').live('mouseout', function() {
        $('.sgpImageHover').remove();
    });

    /**
     * Mark topic as read.
     */
    $('.sgpTopicMarkAsRead').live('click', function() {
        lscache.remove('topic_' + page['section'] + '_' + $(this).attr('name'));
        $(this).fadeOut('slow', function() {
            $(this).remove();
        });
        return false;
    });

    /**
     * Control panel menu.
     */
    $('a.button.sgpMenu, a.sgpMenu').live('click', function() {
        var id = $(this).attr('id');
        $('.sgpPage').each(function() {
            if ($(this).attr('id') != id) {
                $(this).hide();
            } else {
                $(this).fadeIn();
            }
        });

        $('#sgpWorkingIcon').fadeOut('slow', function() {
            $(this).remove();
        });
        $('span.error, span.success').remove();
        return false;
    });

    /**
     * Flush addon localStorage.
     */
    $('#sgp_AO_DeleteAddonCache').live('click', function() {
        $('span.error, span.success').remove();
        $('<span class="sgpCP_Working"><br><center><img src="' + image["loadinggif"] + '" /></center><br></span>').appendTo($(this).parent().parent()).hide().fadeIn(400, function() {
            lscache.flush();
        });

        return false;
    });

    /**
     * Grid view giveaway infocard hover
     */
    $('div.post>.right, .sgpTileViewInfoAbsolute').live('mouseover', function() {
        if (configGet('gi_gridview')) {
            $(this).find('.sgpTileViewInfoRelative').stop(true, true).slideDown('fast');
        }
    });

    $('div.post>.right, .sgpTileViewInfoAbsolute').live('mouseout', function() {
        $(this).find('.sgpTileViewInfoRelative').stop(true, true).slideUp('fast');
    });

    /**
     * Comment previewing. Very messy, would be nice to use .live() but we have to hook it for iframes.
     * @param {Object} obj The page object to do stuff with.
     */
    function commentPreviewingInit(obj) {
        obj.find('.cancel_edit_comment').click(function() {
            $(this).parents('.body_container:first, .comment.child:first, #comment_form:first').find('#commentPreview').hide();
        });

        obj.find('.sgpSubmitReport, .create_submit, .edit_gift_save, input[name="submit_comment"], input[name="edit_comment"]').mouseover(function() {
            var textarea = $(this).parents('form, #sgpUserReport').find('textarea#body, textarea#notes, textarea#body, .user_edit textarea, #edit_gift textarea');
            var top = textarea.scrollTop();
            textarea.val(parseNewLines(textarea.val()));
            textarea.scrollTop(top);
        });

        obj.find('#sgpUserReport textarea#notes, #create_form textarea#body, #create_form textarea#notes, #comment_form textarea#body, .user_edit textarea, #edit_gift textarea').keyup(function() {
            var text = $(this).val();
            var converter = new Showdown.converter();
            var commentHtml = converter.makeHtml(text);

            var previewBox = $(this).parents('.body_container:first, .comment.child:first, #comment_form:first');
            if ($(this).parents('#create_form').length) {
                previewBox = $(this).parents('form');
            } else if ($(this).parents('.body.edit_gift').length) {
                previewBox = $(this).parents('.featured');
            } else if ($(this).parents('#sgpUserReport').length) {
                previewBox = $(this).parents('#sgpUserReport');
            }

            previewBox.find('.sgpPreview').html(commentHtml);

            if (configGet('ge_be_livepreview') && text.length) {
                previewBox.find('#commentPreview').slideDown('slow');
            } else {
                previewBox.find('#commentPreview').slideUp('slow');
            }
        });

        obj.find('#sgpUserReport textarea#notes, #create_form textarea#body, #create_form textarea#notes, #comment_form textarea#body, .user_edit textarea, #edit_gift textarea').click(function() {
            previewComment($(this));
        });

        obj.find('.sgpCheckbox#ge_be_livepreview').click(function() {
            if ($(this).hasClass('disabled')) {
                return false;
            }

            var key = $(this).attr('id');
            var value = $(this).hasClass('checked');
            configSet(key, !value);

            var previewBox = $(this).parents('.body_container:first, .comment.child:first, #comment_form:first');
            if ($(this).parents('#create_form').length) {
                previewBox = $(this).parents('form');
            } else if ($(this).parents('.body.edit_gift').length) {
                previewBox = $(this).parents('.featured');
            } else if ($(this).parents('#sgpUserReport').length) {
                previewBox = $(this).parents('#sgpUserReport');
            }

            previewBox.find('#commentPreview:first').slideToggle('slow');
        });
    }

    /**
     * Better Comment Editor - Live Preview Comment
     * @param {Object} The object to preview from.
     */
    function previewComment(obj) {
        var previewBox = obj.parents('.body_container:first, .comment.child:first, #comment_form:first');
        if (obj.parents('#create_form').length) {
            previewBox = obj.parents('form');
        } else if (obj.parents('.body.edit_gift').length) {
            previewBox = obj.parents('.featured');
        } else if (obj.parents('#sgpUserReport').length) {
            previewBox = obj.parents('#sgpUserReport');
        }

        obj.find('#commentPreview').not(previewBox.find('#commentPreview')).hide();

        var textbox = obj.parents('form, #sgpUserReport').find('textarea#body, textarea#notes, textarea#body, .user_edit textarea, #edit_gift textarea');

        var text = textbox.val();
        var converter = new Showdown.converter();
        var commentHtml = converter.makeHtml(text);

        if (configGet('ge_be_livepreview') && text.length) {
            previewBox.find('#commentPreview').slideDown('slow');
        }

        previewBox.find('.sgpPreview').html(commentHtml);
    }

    /**
     * Better Comment Editor - Parse new line breaks.
     * @param {string} text The text to parse.
     * @return {string} The parsed text to return.
     */
    function parseNewLines(text) {
        if (configGet('ge_be_newlineparse')) {
            return text.replace(/\ *\r?\n|\ *\r/g, "  \n");
        }
        return text;
    }

    /**
     * Better Comment Editor - Text formatting buttons.
     * @param {Object} obj The page object to do stuff with.
     */
    function commentEditorFormatInit(obj) {
        obj.find('#sgpBE_Bold').click(function() {
            var button = $(this);
            var textarea = button.parents('form').find('textarea#body, textarea#notes, textarea#body, .user_edit textarea, #edit_gift textarea');

            wrapText(textarea, '**', '**');
            previewComment(button);
            return false;
        });

        obj.find('#sgpBE_Italic').click(function() {
            var button = $(this);
            var textarea = button.parents('form').find('textarea#body, textarea#notes, textarea#body, .user_edit textarea, #edit_gift textarea');

            wrapText(textarea, '*', '*');
            previewComment(button);
            return false;
        });

        obj.find('#sgpBE_Link').click(function() {
            var button = $(this);
            var textarea = button.parents('form').find('textarea#body, textarea#notes, textarea#body, .user_edit textarea, #edit_gift textarea');

            var linkURL = prompt('Link Address', 'eg: http://www.steamgifts.com');
            if (linkURL != null && linkURL.trim() != 'eg: http://www.steamgifts.com') {
                if (!linkURL.trim().match(/^https?:\/\//)) {
                    linkURL = 'http://' + linkURL.trim();
                }
                var linkTitle = prompt('Link Title', 'eg: SteamGifts');
                if (linkTitle != null && linkTitle != 'eg: SteamGifts') {
                    wrapText(textarea, '', '[' + linkTitle + '](' + linkURL + ')');
                }
            }

            previewComment(button);
            return false;
        });

        obj.find('#sgpBE_Code').click(function() {
            var button = $(this);
            var textarea = button.parents('form').find('textarea#body, textarea#notes, textarea#body, .user_edit textarea, #edit_gift textarea');

            wrapText(textarea, '`', '`');
            previewComment(button);
            return false;
        });

        obj.find('#sgpBE_BulletList').click(function() {
            var button = $(this);
            var textarea = button.parents('form').find('textarea#body, textarea#notes, textarea#body, .user_edit textarea, #edit_gift textarea');

            wrapTextList(textarea, '* ');
            previewComment(button);
            return false;
        });

        obj.find('#sgpBE_NumberList').click(function() {
            var button = $(this);
            var textarea = button.parents('form').find('textarea#body, textarea#notes, textarea#body, .user_edit textarea, #edit_gift textarea');

            wrapTextList(textarea, '1. ');
            previewComment(button);
            return false;
        });

        obj.find('#sgpBE_HorizontalLine').click(function() {
            var button = $(this);
            var textarea = button.parents('form').find('textarea#body, textarea#notes, textarea#body, .user_edit textarea, #edit_gift textarea');

            wrapText(textarea, '', '\n\n---');
            previewComment(button);
            return false;
        });

        obj.find('#sgpBE_Heading').change(function() {
            var button = $(this);
            var value = button.val();
            if (value != 'default') {
                var textarea = button.parents('form').find('textarea#body, textarea#notes, textarea#body, .user_edit textarea, #edit_gift textarea');

                wrapText(textarea, '\n' + value, '');
                previewComment(button);
                button.val('default');
            }
            return false;
        });
    }

    /**
     * Wrap tags around text selection.
     * @param {Object} obj The textbox object to use.
     * @param {string} tagStart The text tag to insert on the left of the selection.
     * @param {string} tagEnd The text tag to insert on the right of the selection.
     */
    function wrapText(obj, tagStart, tagEnd) {
        var start = obj[0].selectionStart;
        var end = obj[0].selectionEnd;
        var text = obj.val();
        var selection = text.substring(start, end).trim();
        var top = obj.scrollTop();
        obj.val(text.substring(0, start) + tagStart + selection + tagEnd + text.substring(end, text.length));
        obj.scrollTop(top);
    }

    /**
     * Wrap list tags around text selection.
     * @param {Object} obj The textbox object to use.
     * @param {string} tagStart The text tag to insert on each line of the selection.
     */
    function wrapTextList(obj, tagStart) {
        var start = obj[0].selectionStart;
        var end = obj[0].selectionEnd;
        var text = obj.val();
        var selection = text.substring(start, end).trim();
        var replacement = '\n' + tagStart + selection.replace(/\n/g, '\n' + tagStart) + '\n\n';
        var top = obj.scrollTop();
        obj.val(text.substring(0, start) + replacement + text.substring(end, text.length));
        obj.scrollTop(top);
    }

    /**
     * Restore comment functionality. Credit: cg.
     */
    $('.delete_comment').live('click', function() {
        $("input[name='delete_comment_id']").val($(this).parent().attr("rel"));
        $('#delete_comment').submit();
        return false;
    });

    $('.comment_reply .edit_comment').live('click', function() {
        $(this).parent().parent().parent().children('.user_body').hide();
        $(this).parent().parent().parent().children('.user_edit').show();
        return false;
    });

    $('.comment_reply .reply_link a').live('click', function() {
        id = $(this).attr('rel');
        depth = parseInt($(this).attr('class')) + 1;
        $("#comment_form #parent_id").val(id);
        $("span.title").html("Add a reply");
        $("span.cancel").show();
        $("#comment_form").insertAfter('.comment#' + id);
        $("#comment_form").addClass('border_container');
        return false;
    });

    $('#comment_form span.cancel a').live('click', function() {
        $("#comment_form #parent_id").val(0);
        $("span.title").html("Add a comment");
        $("span.cancel").hide();
        $("#comment_form").insertAfter('#comment_location');
        $("#comment_form").removeClass('border_container');
        return false;
    });

    $('.cancel_edit_comment').live('click', function() {
        $(this).parent().parent().parent().parent().children('.user_body').show();
        $(this).parent().parent().parent().parent().children('.user_edit').hide();
        return false;
    });

    /**
     * Hook commenting on topics.
     */
    $('input[name="submit_comment"]').live('click', function() {
        if (page['section'] == 'forum' && locationURI.length > 4) {
            var topic = lscache.get('topic_' + page['section'] + '_' + page['id']);
            if (topic == null) {
                topic = {};
            }
            topic['repliedTo'] = true;
            lscache.set('topic_' + page['section'] + '_' + page['id'], topic, configGet('a_unreadcommentexpire_value') * 10080);
        }
    });

    /**
     * Game filter overlay.
     */
    $('#sgpGameFilterPopupButton').live('click', function() {
        $('<div id="sgpOverlayBG"></div>').appendTo('body').fadeIn('slow');
        var configFilterCustomEnabled = configGet('gi_f_enabled') ? ' checked' : '';
        var configFilterLibraryEnabled = configGet('gi_f_library_enabled') ? ' checked' : '';
        $('body').append('<div class="sgpOverlay" style="width:800px; height: 500px; margin-left:-400px; margin-top: -250px"><div class="wrapper" style="padding: 5px;"><div class="register" style="width: 100%;"><div class="invites">\
    <div class="important"><div class="sgpCheckbox' + configFilterCustomEnabled + '" id="gi_f_enabled"> Custom Filters</div> - Add games or partial game names to filter. <i>Case insensitive. Use * as a wildcard.</i></div>\
    <input type="text" class="sgpInput" id="sgpFilteredGamesAddFilter" name="Giveaway name to filter. Case Insensitive." value="Giveaway name to filter. Case Insensitive." size="50"> <a class="sgpAddListItem" id="sgpFilterGame" href="">Add to Filter</a>\
    <div class="relative_dropdown" style="width:150px; padding-top:7px;"><div class="absolute_dropdown" style="width:150px;"><div class="heading" style="font-size:12px; margin-top:1px; margin-bottom:1px;"><a href="" style="padding-left:15px; padding-right:25px;">Import / Export</a></div><div class="items" style="display: none;"><div class="item" style="cursor:pointer;"><a id="sgpFilterExportSGP">Export SteamGifts Plus</a></div><div class="item" style="cursor:pointer;"><a id="sgpFilterImportSGP">Import SteamGifts Plus</a></div><div class="item" style="cursor:pointer;"><a id="sgpFilterImportSGE">Import Zo\'s Addon (SGE)</a></div></div></div></div>\
    <div style="width: 100%; max-height: 110px; overflow-y: scroll; overflow-x: hidden; margin-top:10px;"><div id="sgpFilteredGamesListCustom"></div></div>\
    <div class="important"><div class="sgpCheckbox' + configFilterLibraryEnabled + '" id="gi_f_library_enabled"> Library Filters</div> - Filters games in your library. <i>Filtering for specific library games can enabled or disabled.</i><br><strong style="color:#DD7070;"><img style="margin-bottom:-3px;" src="http://www.steamgifts.com/img/bullet_reported.png"><a href="http://www.steamgifts.com/filter">SteamGifts Filter</a> must be disabled to use SteamGifts Plus Library Filtering.</strong></div>\
    <div class="important"><strong style="color:#4F565A;"><span style="color: #8BBA65;"><img style="margin-bottom: -2px; width: 12px; height: 12px;" src="http://www.steamgifts.com/img/verify_success.png"> Enabled</span> Library Filters</strong></div><div class="clear_both"></div>\
    <div style="width: 100%; max-height: 110px; overflow-y:scroll; overflow-x: hidden; margin-top:10px;"><div id="sgpFilteredGamesListLibraryEnabled" style="margin-top:10px;"></div></div>\
    <div class="important"><strong style="color:#4F565A;"><span style="color: #DD7070;"><img style="margin-bottom: -2px; width: 12px; height: 12px;" src="http://www.steamgifts.com/img/verify_error.png"> Disabled</span> Library Filters</strong></div><div class="clear_both"></div>\
    <div style="width: 100%; max-height: 110px; overflow-y:scroll; overflow-x: hidden; margin-top:10px;"><div id="sgpFilteredGamesListLibraryDisabled" style="margin-top:10px;"></div></div>\
    </div></div></div></div></div>');

        loadGameFilters();
        return false;
    });

    /**
     * Load game filters.
     */
    function loadGameFilters() {
        giveawayFilters = lscache.get('giveawayFilters');
        if (giveawayFilters == null) {
            giveawayFilters = {};
        }

        //Legacy support. Convert library filters to new format.
        var giveawayLibraryFilters = giveawayFilters['libraryFilters'];
        if (giveawayLibraryFilters == null) {
            giveawayLibraryFilters = {};
            giveawayFilters['libraryFilters'] = giveawayLibraryFilters;
        }

        for (var key in giveawayFilters) {
            var name = key.toString().replace(/\*/g, '<span class="sgpFilterWildcard">*</span>');

            if (giveawayFilters[key] && key != 'libraryFilters') {
                giveawayFilters['libraryFilters'][key] = true;
                delete giveawayFilters[key];
            } else if (!giveawayFilters[key] && key != 'libraryFilters') {
                $('#sgpFilteredGamesListCustom').prepend('<div class="sgpFilteredGame"><span>' + key + '</span><a class="sgpRemoveListItem" href=""><img style="margin-bottom: -2px; width: 12px; height: 12px;" src="http://www.steamgifts.com/img/verify_error.png" title="Remove"></a></div>');
            }
        }

        for (var key in giveawayFilters['libraryFilters']) {
            if (giveawayFilters['libraryFilters'][key]) {
                $('#sgpFilteredGamesListLibraryEnabled').prepend('<div class="sgpFilteredGame"><span>' + key + '</span><a class="sgpRemoveListItem LibraryEnabled" href=""><img style="margin-bottom: -2px; width: 12px; height: 12px;" src="http://www.steamgifts.com/img/verify_error.png" title="Disable"></a></div>');
            } else {
                $('#sgpFilteredGamesListLibraryDisabled').prepend('<div class="sgpFilteredGame"><span>' + key + '</span><a class="sgpRemoveListItem LibraryDisabled" href=""><img style="margin-bottom: -2px; width: 12px; height: 12px;" src="http://www.steamgifts.com/img/verify_success.png" title="Enable"></a></div>');
            }
        }
    }

    /**
     * Add custom game filter.
     * @param {string} filterText The text to add to the filter.
     */
    function addCustomFilter(filterText) {
        $('span.error, span.success').remove();

        giveawayFilters = lscache.get('giveawayFilters');
        if (giveawayFilters == null) {
            giveawayFilters = {};
        }

        if (filterText.length < 1 || filterText == 'Giveaway name to filter. Case Insensitive.') {
            $('.sgpFilteredGamesList').prepend('<span class="error">Please enter a filter.<br></span>');
            return false;
        }

        if (!giveawayFilters.hasOwnProperty(filterText)) {
            var name = filterText.toString().replace(/\*/g, '<span class="sgpFilterWildcard">*</span>');

            $('#sgpFilteredGamesListCustom').prepend('<div class="sgpFilteredGame"><span>' + name + '</span><a class="sgpRemoveListItem" href=""><img style="margin-bottom: -2px; width: 12px; height: 12px;" src="http://www.steamgifts.com/img/verify_error.png" title="Remove"></a></div>');

            giveawayFilters[filterText] = false;

            lscache.set('giveawayFilters', giveawayFilters);

            $('.sgpFilteredGamesList').prepend('<span class="success">Successfully added <strong>' + name + '</strong> to your filter.<br></span>');
        } else {
            $('.sgpFilteredGamesList').prepend('<span class="error">This filter already exists.<br></span>');
        }
    }

    $('#sgpFilterGame').live('click', function() {
        addCustomFilter($('#sgpFilteredGamesAddFilter').val());
        return false;
    });

    $('#sgpFilterExportSGP').live('click', function() {
        $('<div id="sgpOverlayBG"></div>').appendTo('body').fadeIn('slow');

        //Don't export library filters.
        var giveawayFiltersExport = giveawayFilters;
        delete giveawayFiltersExport['libraryFilters'];

        $('body').append('<div class="sgpOverlay" style="width: 800px; height: 500px; margin-left:-400px; margin-top: -250px;"><h2> SteamGifts Plus Filter Export. <span style="color: #A4ABAF; float: right;">Save this to a .txt somewhere! </span></h2><div class="clear"></div><textarea style="width: 795px; height:475px;" readonly>SGPFiltersExport=' + JSON.stringify(giveawayFiltersExport) + '</textarea></div>');
        return false;
    });

    $('#sgpFilterImportSGP').live('click', function() {
        $('<div id="sgpOverlayBG"></div>').appendTo('body').fadeIn('slow');
        $('body').append('<div class="sgpOverlay" style="width: 800px; height: 500px; margin-left:-400px; margin-top: -250px;"><h2 style="display: inline-block;"> SteamGifts Plus Filter Import.</h2> <span style="margin-right:10px; float: right;"><a id="sgpImportFilterSGP" href="">Import SGP Filters</a></span><div class="clear"></div><textarea id="sgpImportFilterSGPText" style="width: 795px; height:465px;"></textarea></div>');
        return false;
    });

    $('#sgpImportFilterSGP').live('click', function() {
        $('span.error, span.success').remove();
        var match = $('#sgpImportFilterSGPText').val().match(/SGPFiltersExport={(.*)}/)[1];

        if (match.length) {
            match = '{' + match + '}';
            var json = JSON.parse(match);

            giveawayFilters = lscache.get('giveawayFilters');
            if (giveawayFilters == null) {
                giveawayFilters = {};
            }

            var i = 0;

            for (var key in json) {
                if (key.length && !giveawayFilters.hasOwnProperty(key)) {
                    giveawayFilters[key] = json[key];
                    if (json[key]) {
                        $('#sgpFilteredGamesListLibrary').prepend('<div class="sgpFilteredGame"><span>' + key + '</span><a class="sgpRemoveListItem" href=""><img style="margin-bottom: -2px; width: 12px; height: 12px;" src="http://www.steamgifts.com/img/verify_error.png" title="Remove"></a></div>');
                    } else {
                        $('#sgpFilteredGamesListCustom').prepend('<div class="sgpFilteredGame"><span>' + key + '</span><a class="sgpRemoveListItem" href=""><img style="margin-bottom: -2px; width: 12px; height: 12px;" src="http://www.steamgifts.com/img/verify_error.png" title="Remove"></a></div>');
                    }
                    i++;
                }
            }

            lscache.set('giveawayFilters', giveawayFilters);

            if (i > 0) {
                $('.sgpFilteredGamesList').prepend('<span class="success">Successfully imported <strong>' + i + '</strong> filters.<br></span>');
            } else {
                $('.sgpFilteredGamesList').prepend('<span class="success">No new filters were imported.<br></span>');
            }

            $('.sgpOverlay, #sgpOverlayBG').remove();

        }

        return false;
    });

    $('#sgpFilterImportSGE').live('click', function() {
        $('span.error, span.success').remove();
        if (localStorage.gafFilter && localStorage.gafFilter.trim() != '') {
            var sgeFilterArray = localStorage.gafFilter.split(',');

            giveawayFilters = lscache.get('giveawayFilters');
            if (giveawayFilters == null) {
                giveawayFilters = {};
            }

            var i = 0;

            for (var key = 0; key < sgeFilterArray.length; key++) {
                var name = sgeFilterArray[key];
                if (name.length && !giveawayFilters.hasOwnProperty(name)) {
                    giveawayFilters[name] = false;
                    $('#sgpFilteredGamesListCustom').prepend('<div class="sgpFilteredGame"><span>' + name + '</span><a class="sgpRemoveListItem" href=""><img style="margin-bottom: -2px; width: 12px; height: 12px;" src="http://www.steamgifts.com/img/verify_error.png" title="Remove"></a></div>');
                    i++;
                }
            }

            lscache.set('giveawayFilters', giveawayFilters);

            if (i > 0) {
                $('.sgpFilteredGamesList').prepend('<span class="success">Successfully added <strong>' + i + '</strong> filters from Zo\'s Addon (SteamGifts Enhancement Addon).<br></span>');
            } else {
                $('.sgpFilteredGamesList').prepend('<span class="success">No new filters from Zo\'s Addon (SteamGifts Enhancement Addon) were added.<br></span>');
            }
        } else {
            $('.sgpFilteredGamesList').prepend('<span class="error">No filters for Zo\'s Addon (SteamGifts Enhancement Addon) could be found.<br></span>');
        }
        return false;
    });

    $('input[type="text"]#sgpFilteredGamesAddFilter').live('keypress', function(event) {
        if (event.which == 13) {
            addCustomFilter($(this).val());
        }
    });

    /**
     * Add to Filter givaway button.
     */
    $('#sgpAddToFilter').live('click', function() {
        var name = $(this).parents('.post').find('.left .title a:first').text();
        if (!name.trim().length) {
            return false;
        }

        giveawayFilters = lscache.get('giveawayFilters');
        if (giveawayFilters == null) {
            giveawayFilters = {};
        }

        if (!giveawayFilters.hasOwnProperty(name)) {
            giveawayFilters[name] = false;

            lscache.set('giveawayFilters', giveawayFilters);

            filterGiveaways($('body'));
        }

        return false;
    });

    /**
     * Force update awards and wishlist.
     */
    $('#sgpForceUpdateAwards').live('click', function() {
        updateAwards(true);
        return false;
    });

    $('#sgpForceUpdateWishlist').live('click', function() {
        updateWishlist(true);
        return false;
    });

    $('#sgpForceUpdateLibrary').live('click', function() {
        updateLibrary(true);
        return false;
    });

    $('#sgpForceUpdateDLC').live('click', function() {
        updateDLC(true);
        return false;
    });

    /**
     * Back to Top button.
     */
    $('#sgpBackToTop').live('click', function() {
        $('html,body').animate({
            scrollTop: $('html').offset().top
        });
        return false;
    });


    /**
     * View all user badges.
     */
    $('#sgpViewAllBadges').live('click', function() {
        $('<div id="sgpOverlayBG"></div>').appendTo('body').fadeIn('slow');
        $('body').append('<div class="sgpOverlay" style="width: 415px; height: 420px; margin-left:-200px; margin-top: -185px; z-index: 50; background-color: #313B45; background-image: none;">\
      <div style="position:relative;"><img class="sgpProfileAward" src="' + image.award["1Year"] + '" ><div class="sgpProfileAwardInfo" style="width:365px;"><span style="font-weight:bold;">1 Year Club</span><br>Been a member for 1 year.</div></div>\
      <div style="position:relative;"><img class="sgpProfileAward" src="' + image.award["2Year"] + '" ><div class="sgpProfileAwardInfo" style="width:365px;"><span style="font-weight:bold;">2 Year Club</span><br>Been a member for 2 years.</div></div>\
      <div style="position:relative;"><img class="sgpProfileAward" src="' + image.award["500Value"] + '" ><div class="sgpProfileAwardInfo" style="width:365px;"><span style="font-weight:bold;">Contributor</span><br>Gifted $500 in giveaways.</div></div>\
      <div style="position:relative;"><img class="sgpProfileAward" src="' + image.award["25Wins"] + '" ><div class="sgpProfileAwardInfo" style="width:365px;"><span style="font-weight:bold;">Lucky</span><br>Win 25 giveaways.</div></div>\
      <div style="position:relative;"><img class="sgpProfileAward" src="' + image.award["GroupChat"] + '" ><div class="sgpProfileAwardInfo" style="width:365px;"><span style="font-weight:bold;">Likes To Chat</span> <span style="font-weight:bold; color:#9F4F56; float: right; font-size: 11px; margin-right: 15px;">Manually given to users.</span><br>Actively participates in S.Gifts group chat.</div></div>\
      <div style="position:relative;"><img class="sgpProfileAward" src="' + image.award["Halloween2012"] + '" ><div class="sgpProfileAwardInfo" style="width:365px;"><span style="font-weight:bold;">Saw a Ghost</span> <span style="font-weight:bold; color:#9F4F56; float: right; font-size: 11px; margin-right: 15px;">No longer obtainable.</span><br>Commented on the 2012 Halloween hidden giveaway.</div></div>\
      <div style="position:relative;"><img class="sgpProfileAward" src="' + image.award["Halloween2013"] + '" ><div class="sgpProfileAwardInfo" style="width:365px;"><span style="font-weight:bold;">Gift-o&#39;-lantern</span> <span style="font-weight:bold; color:#9F4F56; float: right; font-size: 11px; margin-right: 15px;">No longer obtainable.</span><br>Participated in the 2013 Halloween forum event.</div></div>\
      <div style="position:relative;"><img class="sgpProfileAward" src="' + image.award["TriviaKnight"] + '" ><div class="sgpProfileAwardInfo" style="width:365px;"><span style="font-weight:bold;">Trivia Knight</span><br>Placed top 5 in a S.Gifts group chat Trivia Night contest.</div></div>\
    </div>');
        return false;
    });

    /**
     * Quickview button hovering.
     */
    $('.sgpQuickviewButton').live('mouseover', function() {
        $(this).stop(true, true).animate({
            'opacity': '0.75'
        }, 100);
    });

    $('.sgpQuickviewButton').live('mouseout', function() {
        $(this).stop(true, true).animate({
            'opacity': '0'
        }, 1000);
    });

    $('.sgpQuickviewButton').live('click', function() {
        $('<div id="sgpOverlayBG"></div>').appendTo('body').fadeIn('slow');
        $('body').append('<div class="sgpOverlay" id="sgpQuickview" style="width:200px; height: 50px; margin-left:-100px; margin-top: -25px;"><div id="sgpQuickviewLoading"><center><img src="' + image["loadinggif"] + '"><p>Loading page...</p><center></div><iframe id="sgpQuickView" style="width:1px; height: 1px; position: absolute; top: -1000px" onload="javascript:sgpQuickviewLoaded(this);" src="http://www.steamgifts.com' + $(this).parents('.right').children('a:first').attr('href') + '"></iframe></div>');
        $(this).parents('.post').addClass("quickview");
        return false;
    });

    /**
     * User reports in Support Tickets.
     */
    $('.spgSubmitReport').click(function() {
        $('div.error').remove();

        if ($('#sgpUserReport select[name="category_id"]').val() == '') {
            $('#sgpUserReport select[name="category_id"]').parent().append('<div class="error">Please select a valid category.</div>');

            $('html,body').scrollTop('html,body');

            return false;
        }

        var username = getURLParameter('user');

        var reportVal = '**User:** [' + username + '](http://www.steamgifts.com/user/' + username + ')  \n  \n**Reason:** ' + $('#sgpUserReport select[name="category_id"]').children("option:selected").text() + '  \n  \n';

        if ($('#sgpUserReport input[name="url"]').val() != '') {
            reportVal += '**URL:** [' + $('#sgpUserReport input[name="url"]').val() + '](' + $('#sgpUserReport input[name="url"]').val() + ')  \n  \n';
        }

        if ($('#sgpUserReport textarea#notes').val() != '') {
            reportVal += '**Notes:** ' + $('#sgpUserReport textarea#notes').val();
        }

        $('.create_giveaway:last textarea#body').val(reportVal);

        $('#create_form').submit();
        return false;
    });

    /**
     * Iterate through an array in chunks, executing a callback on each element.
     * Each chunk is handled asynchronously from the others with a delay betwen each batch.
     * If the provided callback returns false iteration will be halted.
     * Credit: Steve Sobel (Reddit Enhancement Suite http://redditenhancementsuite.com/).
     */
    function forEachChunked(array, chunkSize, delay, call) {
        if (array == null) return;
        if (chunkSize == null || chunkSize < 1) return;
        if (delay == null || delay < 0) return;
        if (call == null) return;
        var counter = 0;
        var length = array.length;

        function doChunk() {
            for (var end = Math.min(array.length, counter + chunkSize); counter < end; counter++) {
                var ret = call(array[counter], counter, array);
                if (ret === false) return;
            }
            if (counter < array.length) {
                setTimeout(doChunk, delay);
            }
        }
        setTimeout(doChunk, delay);
    }

    /**
     * Style additions and tweaks.
     * @param obj What to append the style to.
     */
    function styleInit(obj) {
        obj.find('head').append('<style>\
      .sgpOverlay {\
        position:fixed;\
        float: left;\
        left: 50%;\
        top: 50%;\
        z-index:30;\
        background-color: #F4F4F4;\
        background-image: url("http://www.steamgifts.com/img/wrapper_bg.png");\
        background-position: center top;\
        background-repeat: repeat-x;\
        border: 1px solid #dfe0e0;\
        border-radius: 5px 5px 5px 5px;\
        padding: 5px;\
        color: #4F565A;\
        font-size: 12px;\
      }\
      .sgpOverlay a {\
        color: #4F565A;\
      }\
      .sgpUsertag{\
        text-decoration: none;\
        padding-top: 5px;\
        font-weight: bold;\
        text-shadow: 1px 1px #fff;\
        font-style: normal;\
      }\
      input{\
        font-family: Helvetica,Arial,sans-serif;\
      }\
      .sgpDropdownTextboxItems{\
        background-color: #F9F9FB;\
        background-image: url("http://www.steamgifts.com/img/light_grey_gradient.png");\
        background-position: center top;\
        background-repeat: repeat-x;\
        border: 1px solid #DFE0E0;\
        border-radius: 5px 5px 5px 5px;\
        color: #636E75;\
        font-size: 12px;\
        margin-top: -32px;\
        padding: 25px 6px 4px;\
        width: 300px;\
        margin-left: 4px;\
        position: relative;\
        z-index: 35;\
      }\
      .sgpDropdownTextboxItem{\
        padding-top: 5px;\
      }\
      a.sgpDropdownTextboxItem{\
        color: inherit;\
        text-decoration: none;\
        padding-top: 5px;\
        font-weight: bold;\
        text-shadow: 1px 1px #fff;\
      }\
      .sgpDropdownTextboxRelative{\
        display: inline-block;\
        position: relative;\
      }\
      .sgpDropdownTextboxAbsolute{\
        position: absolute;\
      }\
      .sgpDropdownTextboxHeading{\
        margin-left: 295px;\
        position: relative;\
        top: -12px;\
        z-index: 40;\
      }\
      .sgpUnreadCommentExpireRange{\
        font-weight: bold;\
      }\
      .sgpAddonUpdateCheckRange{\
        font-weight: bold;\
      }\
      .ui-widget-header{\
        background: #91B9E0;\
      }\
      .sgpAddListItem, #sgpImportFilterSGP{\
        text-decoration: none;\
        font-weight: bold;\
        background-color: #5A9321;\
        background-image: url(\"http://www.steamgifts.com/img/view_bg.png\");\
        background-position: center top;\
        background-repeat: repeat-x;\
        border: 0;\
        border-radius: 5px 5px 5px 5px;\
        color: #FFFFFF;\
        font-size: 12px;\
        padding: 5px;\
        text-shadow: none;\
        display: inline-block;\
      }\
      a.sgpAddListItem, a#sgpImportFilterSGP{\
        color: #FFFFFF;\
      }\
      #sgpTaggedUsersAddTag{\
        font-weight: bold;\
        text-shadow: 1px 1px #fff;\
      }\
      #sgpIgnoredUsersAdd, #sgpTaggedUsersAdd, #sgpTaggedUsersAddTag, #sgpFilteredGamesAdd, #gi_f_entrylimit_value, .sgpIgnoredUser, .sgpTaggedUser, .sgpFilteredGame{\
        background-color: #F9F9FB;\
        background-image: url(\"http://www.steamgifts.com/img/light_grey_gradient.png\");\
        background-position: center top;\
        background-repeat: repeat-x;\
        border: 1px solid #DFE0E0;\
        border-radius: 5px 5px 5px 5px;\
        color: #636E75;\
        font-size: 12px;\
        padding: 5px;\
        margin-right: 5px;\
        margin-top: 8px;\
      }\
      #o_gi_f_entrylimit_value: disabled{\
        color: #9F9F9F;\
      }\
      .sgpIgnoredUser, .sgpFilteredGame, .sgpTaggedUser{\
        display: inline-block;\
      }\
      .sgpIgnoredUser a, .sgpTaggedUser a, .sgpFilteredGame a, .sgpIgnoredUser a:hover, .sgpTaggedUser a:hover, .sgpFilteredGame a:hover, .sgpIgnoredUser a:visited, .sgpTaggedUser a:visited, .sgpFilteredGame a:visited{\
        color: #636E75;\
        text-decoration: none;\
      }\
      .sgpIgnoredUser a.sgpRemoveListItem img, .sgpTaggedUser a.sgpRemoveListItem img, .sgpFilteredGame a.sgpRemoveListItem img {\
        opacity: 0.2;\
      }\
      .sgpListItemRed{\
        background-image: none;\
        background-color: #CC0000;\
        box-shadow: 0 10px 10px rgba(255, 255, 255, 0.2) inset;\
        color: #F3ACAC;\
        text-shadow: none;\
      }\
      .sgpListItemGreen{\
        background-image: none;\
        background-color: #E0FFAF;\
        box-shadow: 0 10px 10px rgba(255, 255, 255, 0.2) inset;\
        color: #8BBA65;\
        text-shadow: none;\
      }\
      .sgpFilteredGame a.sgpRemoveListItemGreen {\
        color: #8BBA65;\
        text-shadow: none;\
      }\
      .sgpIgnoredUser a.sgpRemoveListItemRed, .sgpTaggedUser a.sgpRemoveListItemRed, .sgpFilteredGame a.sgpRemoveListItemRed{\
        color: #F3ACAC;\
        text-shadow: none;\
      }\
      .sgpFilteredGame {\
        width: 30%;\
        position: relative;\
      }\
      .sgpRemoveListItem {\
        position: absolute;\
        right: 5px;\
      }\
      span.sgpFilterWildcard{\
        color: #AB00FF;\
        font-weight: bold;\
        font-size: 16px;\
        line-height: 70%;\
      }\
      a.button{\
        background-color: #FFFFFF;\
        border: 1px solid #E4E4E4;\
        border-radius: 10px 10px 10px 10px;\
        color: #999999;\
        display: block;\
        float: left;\
        font-size: 10px;\
        font-weight: bold;\
        padding: 7px 10px;\
        text-decoration: none;\
        width: 110px;\
      }\
      a.button:hover{\
        color: #636E75;\
      }\
      .sgpProfileTagStaff{\
        position: relative;\
        text-align: center;\
        z-index: -1;\
        float: left;\
        width: 128px;\
        font-size: 12px;\
        font-weight: bold;\
        text-shadow:  -1px -1px #1D5380;\
        text-decoration: none;\
        -moz-border-radius: 0 0 10px 10px;\
        border-radius: 0 0 10px 10px;\
        border: 1px solid #4D5A63;\
        color: #CADFED;\
        border-top: 0;\
        padding: 7px 10px;\
        display: block;\
      }\
      .sgpProfileAward{\
        margin-right: 6px;\
        margin-top: 6px;\
      }\
      .sgpProfileAwardInfo{\
        position: absolute;\
        left: 38px;\
        top: 6px;\
        height: 40px;\
        z-index: 2;\
        -moz-border-bottom-colors: none;\
        -moz-border-image: none;\
        -moz-border-left-colors: none;\
        -moz-border-right-colors: none;\
        -moz-border-top-colors: none;\
        background-color: #1D232A;\
        border-color: transparent #334350 #415160 transparent;\
        border-style: solid;\
        border-width: 1px;\
        box-shadow: 0 10px 10px rgba(0, 0, 0, 0.1) inset, 0 3px 3px rgba(0, 0, 0, 0.1) inset;\
        text-shadow: 2px 2px 2px #091C2A;\
        border-radius: 0 10px 10px 0;\
        border-left: 0;\
        font-size: 14px;\
        padding-left: 8px;\
        padding-top: 4px;\
        color: #CADFED;\
      }\
      a.sgpCommentLink, .comment.parent .body_container .author_name a.sgpCommentLink {\
        float: right;\
        font-weight: normal;\
        color: #BFBFBF;\
      }\
      .comment.parent .body_container.sgpCommentLinkedTo {\
        border: 1px solid #DD7070;\
        border-radius: 4px 4px 4px 4px;\
        padding: 5px 5px;\
        width: 890px;\
      }\
      .comment.child .child_container.sgpCommentLinkedTo {\
        border: 1px solid #DD7070;\
      }\
      .comment.parent .body_container .author_name a.sgpCommentLink:hover, .comment.child .child_container .author_name a.sgpCommentLink:hover {\
        color: #4F565A;\
      }\
      a.sgpCommentLink.sgpCommentLinkSelected, .comment.parent .body_container.sgpCommentLinkedTo .author_name a.sgpCommentLink.sgpCommentLinkSelected {\
        color: #DD7070;\
      }\
      .comment.parent .body_container.sgpCommentLinkedTo .author_name a.sgpCommentLink:hover, .comment.child .child_container.sgpCommentLinkedTo .author_name a.sgpCommentLink:hover {\
        color: #DD7070;\
      }\
      .comment.parent {\
        padding-right: 0;\
      }\
      .comment.parent .body_container {\
        width: 900px;\
      }\
      .sgpRowPage {\
        background-color: #F9F9FB;\
        background-image: url("http://steamgifts.com/img/light_grey_gradient.png");\
        background-position: center top;\
        background-repeat: repeat-x;\
        border-color: #E4E4E4;\
        border-right: 1px solid #E4E4E4;\
        border-left: 1px solid #E4E4E4;\
        border-bottom: 1px solid #E4E4E4;\
        border-style: none solid solid;\
        border-width: medium 1px 1px;\
        color: #4F565A;\
        font-size: 13px;\
        font-weight: bold;\
        padding: 10px 15px;\
      }\
      .sgpDisplayControls {\
        font-size: 12px;\
        font-weight: normal;\
        float: right;\
      }\
      .comment.child .author_container {\
        width: 350px;\
      }\
      .comment.child .author_container .author_details {\
        width: 308px;\
      }\
      .sgpDropdownMenuRelative {\
        position: relative;\
        display: inline-block;\
        padding-right: 10px;\
        margin-right: 5px;\
      }\
      .sgpDropdownMenuAbsolute {\
        position: absolute;\
        top: -13px;\
      }\
      .sgpDropdownMenuHeading {\
        padding-bottom: 15px;\
        padding-right: 15px;\
        position: relative;\
        z-index: 2;\
        background-image: url("' + image["dropdownArrowDark"] + '");\
      }\
      .sgpDropdownMenuHeading:hover {\
        background-image: url("http://www.steamgifts.com/img/dropdown_arrow.png");\
      }\
      .sgpDropdownMenuItems {\
        display: inline-block;\
        background-color: #F9F9FB;\
        background-image: url("http://www.steamgifts.com/img/light_grey_gradient.png");\
        background-position: center top;\
        background-repeat: repeat-x;\
        border: 1px solid #dfe0e0;\
        border-radius: 5px 5px 5px 5px;\
        color: #347DB5;\
        font-size: 11px;\
        margin-top: -20px;\
        padding: 5px 6px 4px;\
        width: 120px;\
        margin-left: -115px;\
        position: relative;\
        z-index: 1;\
      }\
      #sgpDropdownMenuLink, #sgpDropdownMenuUsertag, #sgpDropdownMenuIgnore, #sgpDropdownMenuUnignore {\
        color: #347DB5;\
        padding-bottom: 2px;\
      }\
      .sgpDropdownMenuItem {\
        font-size: 12px;\
      }\
      .sgpDropdownMenuItem a{\
        float: left;\
        text-decoration: none;\
      }\
      .sgpDropdownMenuItem a:hover{\
        text-decoration: underline;\
      }\
      .sgpDropdownFilterControlsRelative {\
        width:130px;\
        float:right;\
        margin-left:5px;\
        min-height:1px;\
      }\
      .sgpDropdownFilterControlsAbsolute, .sgpDropdownFilterControlsAbsolute a{\
        color:#636E75;\
        z-index:10;\
      }\
      .sgpDropdownFilterControlsAbsolute{\
        width:128px;\
        position:absolute;\
        font-size:10px;\
        font-weight:bold;\
        text-decoration:none;\
        -moz-border-radius:10px;\
        border-radius:10px;\
        background-color:#fff;\
        border:1px solid #e4e4e4;\
      }\
      .sgpDropdownFilterControlsAbsolute .sgpDropdownFilterControlsHeading a{\
        display:block;\
        text-decoration:none;\
        padding:7px 10px;\
        background-image: url("http://www.steamgifts.com/img/dropdown_arrow.png");\
        background-repeat: no-repeat;\
        background-position: right center;\
        padding-right:25px;\
        color:#999;\
      }\
      .sgpDropdownFilterControlsAbsolute .sgpDropdownFilterControlsHeading.selected a{\
        background-image: url("http://www.steamgifts.com/img/dropdown_arrow_selected.png");\
        color:#636E75;\
      }\
      .sgpDropdownFilterControlsAbsolute .sgpDropdownFilterControlsItems{\
        padding:3px 5px;\
        display:none;\
      }\
      .sgpDropdownFilterControlsAbsolute .sgpDropdownFilterControlsItems .sgpDropdownFilterControlsItem a{\
        padding:3px 10px;\
        display:block;\
        text-decoration:none;\
        color:#999;\
      }\
      .sgpDropdownFilterControlsAbsolute .sgpDropdownFilterControlsItems .sgpDropdownFilterControlsItem a:hover{\
        background-color:#fcfcfc;\
        color:#347DB5;\
        -moz-border-radius:10px;\
        border-radius:10px;\
      }\
      #sgpOverlayBG {\
        position:fixed;\
        display:none;\
        top: 0;\
        left: 0;\
        height: 100%;\
        width: 100%;\
        background: #000000;\
        z-index: 25;\
        opacity: 0.4;\
      }\
      #sgpFilterControlsClose {\
        position:fixed;\
        display:none;\
        top: 0;\
        left: 0;\
        height: 100%;\
        width: 100%;\
        background: #000000;\
        z-index: 5;\
        opacity: 0.0;\
      }\
      .sgpCommentGotoPrev {\
        padding-bottom: 15px;\
        padding-right: 15px;\
        background-image: url("' + image["prevComment"] + '");\
      }\
      .sgpCommentGotoPrev:hover {\
        background-image: url("' + image["prevCommentHover"] + '");\
      }\
      .sgpCommentGotoNext {\
        padding-bottom: 15px;\
        padding-right: 15px;\
        background-image: url("' + image["nextComment"] + '");\
      }\
      .sgpCommentGotoNext:hover {\
        background-image: url("' + image["nextCommentHover"] + '");\
      }\
      .sgpCommentGotoNextNotifcation {\
        text-decoration: none;\
        color: #347DB5;\
      }\
      .sgpImageHover {\
        position: fixed;\
        z-index: 9999;\
        max-width: 100%;\
        max-height: 100%;\
      }\
      .sgpMarkdown {\
        line-height:1.65em;\
      }\
      .sgpMarkdown ul, .sgpMarkdown ol{\
        padding:7px 0;\
        margin:0 25px;\
      }\
      .sgpMarkdown p{\
        padding:7px 0;\
      }\
      .sgpMarkdown a{\
        color:#347DB5;\
      }\
      .sgpMarkdown img{\
        background-color: transparent;\
        border: 0;\
        border-radius: 0;\
        display: inline;\
        margin: -4px 0;\
        padding: 3px;\
      }\
      .sgpMarkdown h1{\
        line-height:26px;\
        font-size:20px;\
      }\
      .sgpMarkdown h2{\
        line-height:24px;\
        font-size:18px;\
      }\
      .sgpMarkdown h3{\
        line-height:22px;\
        font-size:16px;\
      }\
      .sgpMarkdown h4{\
        line-height:20px;\
        font-size:14px;\
      }\
      .sgpMarkdown h5{\
        line-height:18px;\
        font-size:12px;\
      }\
      .sgpMarkdown h6{\
        line-height:16px;\
        font-size:10px;\
      }\
      .markdown img {\
        background-color: transparent;\
        border: 0;\
        border-radius: 0;\
        display: inline;\
        margin: -4px 0;\
        padding: 3px;\
      }\
      a.sgpTopicMarkAsRead {\
        text-decoration: none;\
        color: #DD7070;\
      }\
      a.sgpTopicMarkAsRead:hover {\
        text-decoration: line-through;\
      }\
      input.sgpInput{\
        margin-top: 10px;\
        padding: 5px;\
        background-color: #F9F9FB;\
        border: 1px solid #DFE0E0;\
        background-image: url("http://www.steamgifts.com/img/light_grey_gradient.png");\
        background-repeat: repeat-x;\
        background-position: center top;\
        color: #636E75;\
        font-size: 12px;\
        -moz-border-radius: 5px;\
        border-radius: 5px;\
      }\
      .sgpFilterControls {\
        font-weight: normal;\
        background-color: #FFFFFF;\
        border: 1px solid #E4E4E4;\
        border-radius: 10px 0px 10px 10px;\
        font-size: 12px;\
        position: relative;\
        left: -546px;\
        width: 648px;\
        text-decoration: none;\
        color: #4F565A;\
        padding: 10px 5px 10px 15px;\
        margin-bottom: -10px;\
      }\
      .success strong{\
        color: #636E75;\
      }\
      .sgpFloatDownMenu {\
        padding: 0;\
        display: none;\
        box-shadow: 0 0 8px #000000;\
        z-index: 55;\
        background-color: #25303A;\
        background-image: url("http://www.steamgifts.com/img/background_clean.png");\
        background-repeat: no-repeat;\
        background-position: top center;\
        position: fixed;\
        left: 0px;\
        width: 100%;\
      }\
      #sgpMenuWrapper #navigation {\
        height: 42px;\
        padding: 0;\
      }\
      #sgpMenuWrapper #navigation ol > li {\
        height: 42px;\
      }\
      .sgpQuickviewButton {\
        opacity: 0;\
        font-size: 20px;\
        color: #000000;\
        font-size: 25px;\
        background-color: #cccccc;\
        float: left;\
        position: absolute;\
        width: 144px;\
        height: 29px;\
        padding: 20px;\
        font-weight: bold;\
        cursor: pointer;\
        text-align:center;\
        z-index: 3\
      }\
      input.sgpFilterInput {\
        background-color: #F9F9FB;\
        background-image: url("http://www.steamgifts.com/img/light_grey_gradient.png");\
        background-position: center top;\
        background-repeat: repeat-x;\
        border: 1px solid #DFE0E0;\
        border-radius: 5px 5px 5px 5px;\
        color: #636E75;\
        font-size: 12px;\
        margin-right: 5px;\
        margin-top: 8px;\
        padding: 5px;\
      }\
      .sgpTileViewInfoTitle {\
        font-size: 14px;\
        font-weight: bold;\
        display: inline-block;\
        min-height: 35px;\
        width: 149px;\
      }\
      .sgpTileViewInfoRelative center {\
        font-size: 14px;\
        font-weight: bold;\
      }\
      .sgpTileViewInfoAvatar {\
        width: 35px;\
        display: inline-block;\
        float: right;\
      }\
      .sgpReplyAvatarOverlay {\
        background-image: url("http://www.steamgifts.com/img/avatar_sm_right.png");\
        background-position: right center;\
        background-repeat: no-repeat;\
        height: 32px;\
        width: 35px;\
      }\
      .sgpReplyAvatar {\
        background-position: right center;\
        float: right;\
        background-repeat: no-repeat;\
        display: block;\
        height: 32px;\
        width: 35px;\
      }\
      .sgpTileViewInfoAbsolute {\
        position: absolute;\
      }\
      .sgpTileViewInfoRelative {\
        background-color: #FFFFFF;\
        border-left: 1px solid #E4E4E4;\
        border-bottom: 1px solid #E4E4E4;\
        border-right: 1px solid #E4E4E4;\
        color: #4F565A;\
        display: none;\
        font-size: 12px;\
        left: -6px;\
        top: 74px;\
        padding: 5px;\
        padding-top: 0;\
        position: relative;\
        width: 184px;\
        z-index: 5;\
      }\
      .sgpTileViewContributor {\
        background-color: #BF5353;\
        box-shadow: -2px -2px 3px rgba(50, 50, 50, 0.5);\
        color: #4F1D1D;\
        float: right;\
        font-size: 10px;\
        font-weight: bold;\
        height: 16px;\
        line-height: 16px;\
        padding-left: 5px;\
        padding-right: 5px;\
        position: relative;\
        top: -16px;\
        z-index: 2;\
      }\
      .sgpTileViewContributor.green {\
        background-color: #AFCF4D;\
        color: #555555;\
      }\
      .sgpTileViewCopies {\
        background-color: #DFDFDF;\
        box-shadow: -2px -2px 3px rgba(50, 50, 50, 0.5);\
        color: #555555;\
        float: right;\
        font-size: 10px;\
        font-weight: bold;\
        height: 16px;\
        line-height: 16px;\
        padding-left: 5px;\
        padding-right: 5px;\
        position: relative;\
        top: -16px;\
        z-index: 2;\
      }\
      .sgpTileViewTimeleft {\
        background-color: #5298D3;\
        background-image: url("http://www.steamgifts.com/img/time_icon.png");\
        background-position: 0 -2px;\
        background-repeat: no-repeat;\
        background-origin: 20px;\
        box-shadow: -2px -2px 3px rgba(50, 50, 50, 0.5);\
        color: #FFFFFF;\
        float: right;\
        font-size: 10px;\
        font-weight: bold;\
        height: 16px;\
        line-height: 16px;\
        padding-left: 24px;\
        padding-right: 5px;\
        position: relative;\
        top: -16px;\
        z-index: 2;\
      }\
      .spgSubmitReport {\
        text-decoration:none;\
        display:block;\
        background-image: url("http://www.steamgifts.com/img/view_bg.png");\
        background-repeat: repeat-x;\
        background-position: center top;\
        float:left;\
        background-color:#5a9321;\
        -moz-border-radius:20px;\
        border-radius:20px;\
        border-left:1px solid #89b26a;\
        border-top:1px solid #c8e2b5;\
        border-right:1px solid #63883f;\
        border-bottom:1px solid #3d6417;\
        color:#fff;\
        font-size:13px;\
        font-weight:bold;\
        text-shadow:-1px -1px #5f8e39;\
        text-align:center;\
        padding:5px 15px;\
      }\
      a#sgpSearchGiveawaysCancel {\
        color: #999999;\
        text-decoration: none;\
        font-size: 11px;\
      }\
      a#sgpSearchGiveawaysCancel:hover {\
        color: #347DB5;\
      }\
      .sgpCheckbox:hover {\
        background-image: url("http://www.steamgifts.com/img/checkbox_yes.png");\
      }\
      .sgpCheckbox.disabled:hover {\
        background-image: url("http://www.steamgifts.com/img/checkbox_no.png");\
      }\
      .sgpCheckbox {\
        background-image: url("http://www.steamgifts.com/img/checkbox_no.png");\
        background-repeat: no-repeat;\
        background-position: left center;\
        padding-left:20px;\
        margin-right:5px;\
        line-height:16px;\
        cursor:pointer;\
        display:inline-block;\
        color:#666;\
        font-weight: bold;\
      }\
      .sgpCheckbox.checked {\
        color:#599121;\
        background-image: url("http://www.steamgifts.com/img/checkbox_yes.png");\
      }\
      .sgpCheckbox.disabled {\
        color:#888;\
      }\
      .sgpCheckbox.checked:hover, .sgpCheckbox.checked.disabled {\
        color:#888;\
        background-image: url("http://www.steamgifts.com/img/checkbox_hover.png");\
      }\
      .sgpAuthorDetails {\
        display: inline;\
        font-size: 11px;\
      }\
      .sgpCommentFeedback a {\
      }\
    </style>');
    }

    //Showdown library
    var Showdown = {};
    Showdown.converter = function() {
        var g_urls;
        var g_titles;
        var g_html_blocks;
        var g_list_level = 0;
        this.makeHtml = function(text) {
            text = parseNewLines(text);
            g_urls = new Array();
            g_titles = new Array();
            g_html_blocks = new Array();
            text = text.replace(/~/g, "~T");
            text = text.replace(/\$/g, "~D");
            text = text.replace(/\r\n/g, "\n"); // DOS to Unix
            text = text.replace(/\r/g, "\n"); // Mac to Unix
            text = "\n\n" + text + "\n\n";
            text = _Detab(text);
            text = text.replace(/^[ \t]+$/mg, "");
            text = _HashHTMLBlocks(text);
            text = _StripLinkDefinitions(text);
            text = _RunBlockGamut(text);
            text = _UnescapeSpecialChars(text);
            text = text.replace(/~D/g, "$$");
            text = text.replace(/~T/g, "~");
            return text;
        }
        var _StripLinkDefinitions = function(text) {
            var text = text.replace(/^[ ]{0,3}\[(.+)\]:[ \t]*\n?[ \t]*<?(\S+?)>?[ \t]*\n?[ \t]*(?:(\n*)["(](.+?)[")][ \t]*)?(?:\n+|\Z)/gm,
                function(wholeMatch, m1, m2, m3, m4) {
                    m1 = m1.toLowerCase();
                    g_urls[m1] = _EncodeAmpsAndAngles(m2); // Link IDs are case-insensitive
                    if (m3) {
                        return m3 + m4;
                    } else if (m4) {
                        g_titles[m1] = m4.replace(/"/g, "&quot;");
                    }
                    return "";
                }
            );
            return text;
        }
        var _HashHTMLBlocks = function(text) {
            text = text.replace(/\n/g, "\n\n");
            var block_tags_a = "p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|ins|del"
            var block_tags_b = "p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math"
            text = text.replace(/^(<(p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|ins|del)\b[^\r]*?\n<\/\2>[ \t]*(?=\n+))/gm, hashElement);
            text = text.replace(/^(<(p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math)\b[^\r]*?.*<\/\2>[ \t]*(?=\n+)\n)/gm, hashElement);
            text = text.replace(/(\n[ ]{0,3}(<(hr)\b([^<>])*?\/?>)[ \t]*(?=\n{2,}))/g, hashElement);
            text = text.replace(/(\n\n[ ]{0,3}<!(--[^\r]*?--\s*)+>[ \t]*(?=\n{2,}))/g, hashElement);
            text = text.replace(/(?:\n\n)([ ]{0,3}(?:<([?%])[^\r]*?\2>)[ \t]*(?=\n{2,}))/g, hashElement);
            text = text.replace(/\n\n/g, "\n");
            return text;
        }
        var hashElement = function(wholeMatch, m1) {
            var blockText = m1;
            blockText = blockText.replace(/\n\n/g, "\n");
            blockText = blockText.replace(/^\n/, "");
            blockText = blockText.replace(/\n+$/g, "");
            blockText = "\n\n~K" + (g_html_blocks.push(blockText) - 1) + "K\n\n";
            return blockText;
        };
        var _RunBlockGamut = function(text) {
            text = _DoHeaders(text);
            var key = hashBlock("<hr />");
            text = text.replace(/^[ ]{0,2}([ ]?\*[ ]?){3,}[ \t]*$/gm, key);
            text = text.replace(/^[ ]{0,2}([ ]?\-[ ]?){3,}[ \t]*$/gm, key);
            text = text.replace(/^[ ]{0,2}([ ]?\_[ ]?){3,}[ \t]*$/gm, key);
            text = _DoLists(text);
            text = _DoCodeBlocks(text);
            text = _HashHTMLBlocks(text);
            text = _FormParagraphs(text);
            return text;
        }
        var _RunSpanGamut = function(text) {
            text = _DoCodeSpans(text);
            text = _EscapeSpecialCharsWithinTagAttributes(text);
            text = _EncodeBackslashEscapes(text);
            text = _DoAnchors(text);
            text = _DoAutoLinks(text);
            text = _EncodeAmpsAndAngles(text);
            text = _DoItalicsAndBold(text);
            text = text.replace(/  +\n/g, " <br>\n");
            return text;
        }
        var _EscapeSpecialCharsWithinTagAttributes = function(text) {
            var regex = /(<[a-z\/!$]("[^"]*"|'[^']*'|[^'">])*>|<!(--.*?--\s*)+>)/gi;
            text = text.replace(regex, function(wholeMatch) {
                var tag = wholeMatch.replace(/(.)<\/?code>(?=.)/g, "$1`");
                tag = escapeCharacters(tag, "\\`*_");
                return tag;
            });
            return text;
        }
        var _DoAnchors = function(text) {
            text = text.replace(/(\[((?:\[[^\]]*\]|[^\[\]])*)\][ ]?(?:\n[ ]*)?\[(.*?)\])()()()()/g, writeAnchorTag);
            text = text.replace(/(\[((?:\[[^\]]*\]|[^\[\]])*)\]\([ \t]*()<?(.*?)>?[ \t]*((['"])(.*?)\6[ \t]*)?\))/g, writeAnchorTag);
            text = text.replace(/(\[([^\[\]]+)\])()()()()()/g, writeAnchorTag);
            return text;
        }
        var writeAnchorTag = function(wholeMatch, m1, m2, m3, m4, m5, m6, m7) {
            if (m7 == undefined) m7 = "";
            var whole_match = m1;
            var link_text = m2;
            var link_id = m3.toLowerCase();
            var url = m4;
            var title = m7;
            if (url == "") {
                if (link_id == "") {
                    link_id = link_text.toLowerCase().replace(/ ?\n/g, " ");
                }
                url = "#" + link_id;
                if (g_urls[link_id] != undefined) {
                    url = g_urls[link_id];
                    if (g_titles[link_id] != undefined) {
                        title = g_titles[link_id];
                    }
                } else {
                    if (whole_match.search(/\(\s*\)$/m) > -1) {
                        url = "";
                    } else {
                        return whole_match;
                    }
                }
            }
            url = escapeCharacters(url, "*_");
            var result = "<a href=\"" + url + "\"";
            if (title != "") {
                title = title.replace(/"/g, "&quot;");
                title = escapeCharacters(title, "*_");
                result += " title=\"" + title + "\"";
            }
            result += ">" + link_text + "</a>";
            return result;
        }
        var _DoHeaders = function(text) {
            text = text.replace(/^(.+)[ \t]*\n=+[ \t]*\n+/gm,
                function(wholeMatch, m1) {
                    return hashBlock("<h1>" + _RunSpanGamut(m1) + "</h1>");
                });
            text = text.replace(/^(.+)[ \t]*\n-+[ \t]*\n+/gm,
                function(matchFound, m1) {
                    return hashBlock("<h2>" + _RunSpanGamut(m1) + "</h2>");
                });
            text = text.replace(/^(\#{1,6})[ \t]*(.+?)[ \t]*\#*\n+/gm,
                function(wholeMatch, m1, m2) {
                    var h_level = m1.length;
                    return hashBlock("<h" + h_level + ">" + _RunSpanGamut(m2) + "</h" + h_level + ">");
                });
            return text;
        }
        var _ProcessListItems;
        var _DoLists = function(text) {
            text += "~0";
            var whole_list = /^(([ ]{0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(~0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/gm;
            if (g_list_level) {
                text = text.replace(whole_list, function(wholeMatch, m1, m2) {
                    var list = m1;
                    var list_type = (m2.search(/[*+-]/g) > -1) ? "ul" : "ol";
                    list = list.replace(/\n{2,}/g, "\n\n\n");;
                    var result = _ProcessListItems(list);
                    result = result.replace(/\s+$/, "");
                    result = "<" + list_type + ">" + result + "</" + list_type + ">\n";
                    return result;
                });
            } else {
                whole_list = /(\n\n|^\n?)(([ ]{0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(~0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/g;
                text = text.replace(whole_list, function(wholeMatch, m1, m2, m3) {
                    var runup = m1;
                    var list = m2;
                    var list_type = (m3.search(/[*+-]/g) > -1) ? "ul" : "ol";
                    var list = list.replace(/\n{2,}/g, "\n\n\n");;
                    var result = _ProcessListItems(list);
                    result = runup + "<" + list_type + ">\n" + result + "</" + list_type + ">\n";
                    return result;
                });
            }
            text = text.replace(/~0/, "");
            return text;
        }
        _ProcessListItems = function(list_str) {
            g_list_level++;
            list_str = list_str.replace(/\n{2,}$/, "\n");
            list_str += "~0";
            list_str = list_str.replace(/(\n)?(^[ \t]*)([*+-]|\d+[.])[ \t]+([^\r]+?(\n{1,2}))(?=\n*(~0|\2([*+-]|\d+[.])[ \t]+))/gm,
                function(wholeMatch, m1, m2, m3, m4) {
                    var item = m4;
                    var leading_line = m1;
                    var leading_space = m2;
                    if (leading_line || (item.search(/\n{2,}/) > -1)) {
                        item = _RunBlockGamut(_Outdent(item));
                    } else {
                        item = _DoLists(_Outdent(item));
                        item = item.replace(/\n$/, ""); // chomp(item)
                        item = _RunSpanGamut(item);
                    }
                    return "<li>" + item + "</li>\n";
                }
            );
            list_str = list_str.replace(/~0/g, "");
            g_list_level--;
            return list_str;
        }
        var _DoCodeBlocks = function(text) {
            text += "~0";
            text = text.replace(/(?:\n\n|^)((?:(?:[ ]{4}|\t).*\n+)+)(\n*[ ]{0,3}[^ \t\n]|(?=~0))/g,
                function(wholeMatch, m1, m2) {
                    var codeblock = m1;
                    var nextChar = m2;
                    codeblock = _EncodeCode(_Outdent(codeblock));
                    codeblock = _Detab(codeblock);
                    codeblock = codeblock.replace(/^\n+/g, ""); // trim leading newlines
                    codeblock = codeblock.replace(/\n+$/g, ""); // trim trailing whitespace
                    codeblock = "<pre><code>" + codeblock + "\n</code></pre>";
                    return hashBlock(codeblock) + nextChar;
                }
            );
            text = text.replace(/~0/, "");
            return text;
        }
        var hashBlock = function(text) {
            text = text.replace(/(^\n+|\n+$)/g, "");
            return "\n\n~K" + (g_html_blocks.push(text) - 1) + "K\n\n";
        }
        var _DoCodeSpans = function(text) {
            text = text.replace(/(^|[^\\])(`+)([^\r]*?[^`])\2(?!`)/gm,
                function(wholeMatch, m1, m2, m3, m4) {
                    var c = m3;
                    c = c.replace(/^([ \t]*)/g, ""); // leading whitespace
                    c = c.replace(/[ \t]*$/g, ""); // trailing whitespace
                    c = _EncodeCode(c);
                    return m1 + "<code>" + c + "</code>";
                });
            return text;
        }
        var _EncodeCode = function(text) {
            text = text.replace(/&/g, "&amp;");
            text = text.replace(/</g, "&lt;");
            text = text.replace(/>/g, "&gt;");
            text = escapeCharacters(text, "\*_{}[]\\", false);
            return text;
        }
        var _DoItalicsAndBold = function(text) {
            text = text.replace(/(\*\*|__)(?=\S)([^\r]*?\S[*_]*)\1/g,
                "<strong>$2</strong>");
            text = text.replace(/(\*|_)(?=\S)([^\r]*?\S)\1/g,
                "<em>$2</em>");
            return text;
        }
        var _FormParagraphs = function(text) {
            text = text.replace(/^\n+/g, "");
            text = text.replace(/\n+$/g, "");
            var grafs = text.split(/\n{2,}/g);
            var grafsOut = new Array();
            var end = grafs.length;
            for (var i = 0; i < end; i++) {
                var str = grafs[i];
                if (str.search(/~K(\d+)K/g) >= 0) {
                    grafsOut.push(str);
                } else if (str.search(/\S/) >= 0) {
                    str = _RunSpanGamut(str);
                    str = str.replace(/^([ \t]*)/g, "<p>");
                    str += "</p>"
                    grafsOut.push(str);
                }

            }
            end = grafsOut.length;

            for (var i = 0; i < end; i++) {
                while (grafsOut[i].search(/~K(\d+)K/) >= 0) {
                    var blockText = g_html_blocks[RegExp.$1];
                    blockText = blockText.replace(/\$/g, "$$$$"); // Escape any dollar signs
                    grafsOut[i] = grafsOut[i].replace(/~K\d+K/, blockText);
                }
            }
            return grafsOut.join("\n\n");
        }
        var _EncodeAmpsAndAngles = function(text) {
            text = text.replace(/&(?!#?[xX]?(?:[0-9a-fA-F]+|\w+);)/g, "&amp;");
            text = text.replace(/<(?![a-z\/?\$!])/gi, "&lt;");
            return text;
        }
        var _EncodeBackslashEscapes = function(text) {
            text = text.replace(/\\(\\)/g, escapeCharacters_callback);
            text = text.replace(/\\([`*_{}\[\]()>#+-.!])/g, escapeCharacters_callback);
            return text;
        }
        var _DoAutoLinks = function(text) {
            text = text.replace(/<((https?|ftp|dict):[^'">\s]+)>/gi, "<a href=\"$1\">$1</a>");
            text = text.replace(/<(?:mailto:)?([-.\w]+\@[-a-z0-9]+(\.[-a-z0-9]+)*\.[a-z]+)>/gi,
                function(wholeMatch, m1) {
                    return _EncodeEmailAddress(_UnescapeSpecialChars(m1));
                }
            );
            return text;
        }
        var _EncodeEmailAddress = function(addr) {
            function char2hex(ch) {
                var hexDigits = '0123456789ABCDEF';
                var dec = ch.charCodeAt(0);
                return (hexDigits.charAt(dec >> 4) + hexDigits.charAt(dec & 15));
            }
            var encode = [

                function(ch) {
                    return "&#" + ch.charCodeAt(0) + ";";
                },
                function(ch) {
                    return "&#x" + char2hex(ch) + ";";
                },
                function(ch) {
                    return ch;
                }
            ];
            addr = "mailto:" + addr;
            addr = addr.replace(/./g, function(ch) {
                if (ch == "@") {
                    ch = encode[Math.floor(Math.random() * 2)](ch);
                } else if (ch != ":") {
                    var r = Math.random();
                    ch = (
                        r > .9 ? encode[2](ch) :
                        r > .45 ? encode[1](ch) :
                        encode[0](ch)
                    );
                }
                return ch;
            });
            addr = "<a href=\"" + addr + "\">" + addr + "</a>";
            addr = addr.replace(/">.+:/g, "\">"); // strip the mailto: from the visible part
            return addr;
        }
        var _UnescapeSpecialChars = function(text) {
            text = text.replace(/~E(\d+)E/g,
                function(wholeMatch, m1) {
                    var charCodeToReplace = parseInt(m1);
                    return String.fromCharCode(charCodeToReplace);
                }
            );
            return text;
        }
        var _Outdent = function(text) {
            text = text.replace(/^(\t|[ ]{1,4})/gm, "~0"); // attacklab: g_tab_width
            text = text.replace(/~0/g, "")
            return text;
        }
        var _Detab = function(text) {
            text = text.replace(/\t(?=\t)/g, "    "); // attacklab: g_tab_width
            text = text.replace(/\t/g, "~A~B");
            text = text.replace(/~B(.+?)~A/g,
                function(wholeMatch, m1, m2) {
                    var leadingText = m1;
                    var numSpaces = 4 - leadingText.length % 4; // attacklab: g_tab_width
                    for (var i = 0; i < numSpaces; i++) leadingText += " ";
                    return leadingText;
                }
            );
            text = text.replace(/~A/g, "    "); // attacklab: g_tab_width
            text = text.replace(/~B/g, "");
            return text;
        }
        var escapeCharacters = function(text, charsToEscape, afterBackslash) {
            var regexString = "([" + charsToEscape.replace(/([\[\]\\])/g, "\\$1") + "])";
            if (afterBackslash) {
                regexString = "\\\\" + regexString;
            }
            var regex = new RegExp(regexString, "g");
            text = text.replace(regex, escapeCharacters_callback);
            return text;
        }
        var escapeCharacters_callback = function(wholeMatch, m1) {
            var charCodeToEscape = m1.charCodeAt(0);
            return "~E" + charCodeToEscape + "E";
        }
    }
})(jQuery);