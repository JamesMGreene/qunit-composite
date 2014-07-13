/**
 * JUnit reporter for QUnit v1.0.2pre
 *
 * https://github.com/jquery/qunit-composite
 *
 * Copyright 2013 jQuery Foundation and other contributors
 * Released under the MIT license.
 * https://jquery.org/license/
 */
(function( QUnit ) {
var iframe, hasBound, addClass,
	modules = 1,
	executingComposite = false;

// TODO: Kill this fallback method once QUnit 1.12 is released
addClass = typeof QUnit.addClass === "function" ?
	QUnit.addClass :
	(function() {
		var hasClass = typeof QUnit.hasClass === "function" ?
			QUnit.hasClass :
			function hasClass( elem, name ) {
				return ( " " + elem.className + " " ).indexOf( " " + name + " " ) > -1;
			};
		return function addClass( elem, name ) {
			if ( !hasClass( elem, name ) ) {
				elem.className += ( elem.className ? " " : "" ) + name;
			}
		};
	})();

function runSuite( suite, queryTop ) {
	var path, query;

	if ( QUnit.is( "object", suite ) ) {
		path = suite.path;
		suite = suite.name;
	} else {
		path = suite;
	}

	// Parse this iframe's query string
	query = parseQuery( path );

	// If queryTop or query is not empty...
	if ( queryTop || query ) {
		// Replace this iframe's query keys with matching keys from top frame
		var search = $.extend( query, queryTop ),
			urlParts = path.split( "?" ),
			pathParts = path.split( "#" ),
			hash = pathParts[ 1 ],
			searchPairs = [], pathQuery;

		// If there is anything after "?",
		// take only that's what's before it for now
		if ( urlParts.length > 1 || pathParts.length > 1 ) {
			path = pathParts[ 0 ].split( "?" )[ 0 ];
		}

		// Join query key-value pairs into array if pairs
		$.each( search, function ( key, value ) {
			searchPairs.push( key + "=" + (value || "") );
		});

		pathQuery = searchPairs.join( "&" )
			+ ( hash ? "#" + hash : "" );

		// Assemble path
		path = path + ( pathQuery.length ? "?" + pathQuery : "" );
	}

	QUnit.asyncTest( suite, function() {
		iframe.setAttribute( "src", path );
		// QUnit.start is called from the child iframe's QUnit.done hook.
	});
}

function initIframe() {
	var iframeWin,
		body = document.body;

	function onIframeLoad() {
		var moduleName, testName,
			count = 0;

		if ( !iframe.src ) {
			return;
		}

		iframeWin.QUnit.moduleStart(function( data ) {
			// Capture module name for messages
			moduleName = data.name;
		});

		iframeWin.QUnit.testStart(function( data ) {
			// Capture test name for messages
			testName = data.name;
		});
		iframeWin.QUnit.testDone(function() {
			testName = undefined;
		});

		iframeWin.QUnit.log(function( data ) {
			if (testName === undefined) {
				return;
			}
			// Pass all test details through to the main page
			var message = ( moduleName ? moduleName + ": " : "" ) + testName + ": " + ( data.message || ( data.result ? "okay" : "failed" ) );
			expect( ++count );
			QUnit.push( data.result, data.actual, data.expected, message );
		});

		// Continue the outer test when the iframe's test is done
		iframeWin.QUnit.done( QUnit.start );
	}

	iframe = document.createElement( "iframe" );
	iframe.className = "qunit-composite-suite";
	body.appendChild( iframe );

	QUnit.addEvent( iframe, "load", onIframeLoad );

	iframeWin = iframe.contentWindow;
}

function parseQuery( str ) {
	var urlParts = str.split( "?" ),
		search, query, queryPart;

	// No query present in given URL
	if ( urlParts.length === 1 ) {
		return {};
	}

	search = urlParts[ 1 ].split( "#" )[ 0 ].split( "&" ),
	query = {};

	// Parse query into object
	for( var i in search ) {
		if ( search.hasOwnProperty( i ) && search[ i ] ) {
			// Add to query object
			queryPart = search[ i ].split( "=" );
			query[ queryPart [ 0 ] ] = queryPart[ 1 ];
		}
	}

	return query;
}

/**
 * @param {string} [name] Module name to group these test suites.
 * @param {Array} suites List of suites where each suite
 *  may either be a string (path to the html test page),
 *  or an object with a path and name property.
 */
QUnit.testSuites = function( name, suites ) {
	var i, suitesLen, query, queryKeys;

	if ( arguments.length === 1 ) {
		suites = name;
		name = "Composition #" + modules++;
	}
	suitesLen = suites.length;

	if ( !hasBound ) {
		hasBound = true;
		QUnit.begin( initIframe );

		// TODO: Would be better to use something like QUnit.once( 'moduleDone' )
		// after the last test suite.
		QUnit.moduleDone( function () {
			executingComposite = false;
		} );

		QUnit.done(function() {
			iframe.style.display = "none";
		});
	}

	QUnit.module( name, {
		setup: function () {
			executingComposite = true;
		}
	});

	query = parseQuery( location.search );
	queryKeys = [];

	// Pass only those query keys that are defined in QUnit.config.urlConfig:
	// Find the keys first
	$.each( QUnit.config.urlConfig, function ( i, config ) {
		queryKeys.push( config.id );
	});

	// Remove keys that aren't part of QUnit.config.urlConfig from set
	$.each( query, function ( queryKey, value ) {
		if ( $.inArray( queryKey, queryKeys ) === -1 ) {
			delete query[ queryKey ];
		}
	});

	for ( i = 0; i < suitesLen; i++ ) {
		runSuite( suites[ i ], query );
	}
};

QUnit.testDone(function() {
	if ( !executingComposite ) {
		return;
	}

	var i, len,
		current = QUnit.id( this.config.current.id ),
		children = current.children,
		src = iframe.src;

	QUnit.addEvent( current, "dblclick", function( e ) {
		var target = e && e.target ? e.target : window.event.srcElement;
		if ( target.nodeName.toLowerCase() === "span" || target.nodeName.toLowerCase() === "b" ) {
			target = target.parentNode;
		}
		if ( window.location && target.nodeName.toLowerCase() === "strong" ) {
			window.location = src;
		}
	});

	// Undo QUnit's auto-expansion for bad tests
	for ( i = 0, len = children.length; i < len; i++ ) {
		if ( children[ i ].nodeName.toLowerCase() === "ol" ) {
			addClass( children[ i ], "qunit-collapsed" );
		}
	}

	// Update Rerun link to point to the standalone test suite page
	current.getElementsByTagName( "a" )[ 0 ].href = src;
});

})( QUnit );
