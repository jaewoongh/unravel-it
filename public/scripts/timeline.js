// Some constants
var ARTICLE_WIDTH_SINGLE = 800;		// px
var ARTICLE_WIDTH_MULTI = 500;		// px
var TIDBIT_GAP_MIN = 3;				// em
var TIDBIT_GAP_MAX = 20;			// em
var TIDBIT_GAPS = [{ min: 1, max: 5 }, { min: 2, max: 10 }, { min: 3, max: 15 }, { min: 4, max: 20 }, { min: 5, max: 25 }, { min: 8, max: 30 }];
var TIDBIT_BUFFER_HEADER = 2;		// em
var ENTRY_MARGIN_LEFT = 0;			// em
var ENTRY_MARGIN_INBETWEEN = 0.7;	// em
var ENTRY_MARGIN_TOP = 0.5;			// em
var ENTRY_MARGIN_BOTTOM = 2;		// em
// var LEFTBAR_WIDTH_EXPANDED = 208;	// px
// var LEFTBAR_WIDTH_FOLDED = 48;		// px
var LEFTBAR_WIDTH = 48;
var VIEW_ZOOM_MAX = 1.3;
var VIEW_ZOOM_MIN = 0.7;

// Global variables for key data elements
var entries = [];
var headers = [];
var tidbits = [];
var scrollbar;
var scroller;
var leftbar;
var credits;
var timelineView;
var leftSearchCard;

var headerHeight = 0;
var timeDiffMin = Number.MAX_VALUE;
var timeDiffMax = 0;
var isOne;
var isStickyUp = false;
var tidbitGapLevel = 2;
var viewZoomLevel = 1.0;
var reverseTime = false;
var foldedAll = false;

// Restore view settings if applicable
var getViews = function() {
	var params = location.hash;
	if (!Boolean(params)) return;

	var getParam = function(name) {
		var regex = new RegExp('[#&]' + name + '=?([^&#]*)');
		var result = regex.exec(params);

		return result === null ? null : result[1];
	};
	
	tidbitGapLevel = parseInt(getParam('gap')) || 2;
	viewZoomLevel = parseFloat(getParam('zoom')) || 1.0;
	reverseTime = getParam('reverse') === null ? false : true;
	foldedAll = getParam('fold') === null ? false : true;
};

var applyViews = function() {
	setGap();
	setZoom();
	if (foldedAll) foldAll();
};

var viewString = function() {
	var currentViewSettings = '';
	if (tidbitGapLevel != 2) currentViewSettings += '&gap=' + tidbitGapLevel;
	if (Math.abs(viewZoomLevel - 1) > 0.05) currentViewSettings += '&zoom=' + parseFloat((Math.round(viewZoomLevel*10)*0.1).toString().replace(/(\.\d)(\d+)/, '$1'));
	if (reverseTime) currentViewSettings += '&reverse';
	if (foldedAll) currentViewSettings += '&fold';
	if (currentViewSettings.length > 0) currentViewSettings = '#' + currentViewSettings.substring(1);
	return currentViewSettings;
};

var setViews = function() {
	var hash = viewString();
	window.location.replace(window.location.pathname + (hash.length > 0 ? hash : '#'));
};

var setZoom = function(zoom) {
	timelineView.style.webkitTransform = 'scale(' + viewZoomLevel + ')';
	timelineView.style.transform = 'scale(' + viewZoomLevel + ')';
	for (var i = 0; i < entries.length; i++) {
		entries[i].placeSticky(viewZoomLevel);
	}
};

var setGap = function(level) {
	TIDBIT_GAP_MIN = TIDBIT_GAPS[tidbitGapLevel].min;
	TIDBIT_GAP_MAX = TIDBIT_GAPS[tidbitGapLevel].max;
	placeTidbits();
};

var foldAll = function() {
	for (var i = 0; i < tidbits.length; i++) tidbits[i].fold();
	foldedAll = true;
	placeTidbits();
};

var expandAll = function() {
	for (var i = 0; i < tidbits.length; i++) tidbits[i].expand();
	foldedAll = false;
	placeTidbits();
};

var toggleFold = function() {
	var toFoldOrNot = 0;
	for (var i = 0; i < tidbits.length; i++) {
		toFoldOrNot += tidbits[i].isFolded() ? -1 : 1;
	}
	if (toFoldOrNot >= 0) foldAll();
	else expandAll();
};

// Grab entries and tidbits
var getThings = function() {
	// Get entries
	entries = [];
	var elemEntries = document.getElementsByTagName('article');
	for (var i = 0; i < elemEntries.length; i++) {
		entries.push(new Entry(elemEntries[i], i));
		entries[i].sticky = document.getElementsByClassName('sticky-header')[i];
	}

	// Change URL - in case of the given url has duplicate slugs
	var slugs = [];
	for (var i = 0; i < entries.length; i++) {
		slugs[entries[i].column] = entries[i].slug;
	}
	var newUrl = '/tl/' + slugs.toString().replace(/,/g, '/') + viewString();
	window.history.replaceState({ urlPath: newUrl }, '', newUrl);

	// Get tidbits
	tidbits = [];
	var elemTidbits = document.getElementsByTagName('section');
	for (var i = 0; i < elemTidbits.length; i++) {
		var mom = entries[parseInt(elemTidbits[i].dataset.column)];
		var tidbit = new Tidbit(elemTidbits[i], mom);
		tidbits.push(tidbit);
		mom.addTidbit(tidbit);
	}

	// Get scroll thingies
	scrollbar = document.getElementById('top-scrollbar');
	scroller = document.getElementById('top-scroller');

	// Get the whole view but for sidebar and scroll thingies
	timelineView = document.getElementById('timelineview');

	// Set left search bar as an object
	leftSearchCard = {};
	leftSearchCard.element = document.getElementById('left-search-card');
	leftSearchCard.searchText = document.getElementById('left-search-text');
	leftSearchCard.searchButton = document.getElementById('left-search-button');
	leftSearchCard.closeButton = document.getElementById('left-search-close');
	leftSearchCard.width = 300;
	leftSearchCard.isUp = false;
	leftSearchCard.pullOut = function() {
		this.element.style.display = 'block';
		this.element.style.height = entries[0].element.offsetHeight + 'px';
		window.clearTimeout(this.timeout);
		this.timeout = window.setTimeout(function() {
			this.element.style.webkitTransform = 'translate3d(0,0,0)';
			this.element.style.transform = 'translate3d(0,0,0)';
		}.bind(this), 10);
		this.isUp = true;
		document.getElementById('left-search-text').focus();
		placeEntries();
	}.bind(leftSearchCard);
	leftSearchCard.putBack = function() {
		this.element.style.webkitTransform = 'translate3d(' + (-this.width) + 'px,0,0)';
		this.element.style.transform = 'translate3d(' + (-this.width) + 'px,0,0)';
		window.clearTimeout(this.timeout);
		this.timeout = window.setTimeout(function() {
			this.searchText.value = '';
			this.searchResult.innerHTML = '';
			this.element.style.display = 'none';
		}.bind(this), 210);
		this.isUp = false;
		placeEntries();
	}.bind(leftSearchCard);
	leftSearchCard.toggle = function() {
		if (this.isUp) this.putBack();
		else this.pullOut();
	}.bind(leftSearchCard);
	leftSearchCard.elemLoading = document.createElement('div');
	var elemLoadingIcon = document.createElement('img');
	elemLoadingIcon.src = '/assets/images/icon-loading-32.gif';
	elemLoadingIcon.style.width = '16px';
	elemLoadingIcon.style.height = '16px';
	elemLoadingIcon.style.margin = '2em 0';
	leftSearchCard.elemLoading.appendChild(elemLoadingIcon);
	leftSearchCard.elemNoResult = document.createElement('div');
	var elemNoResultMessage = document.createElement('h3');
	elemNoResultMessage.innerHTML = 'No search result :(';
	leftSearchCard.elemNoResult.appendChild(elemNoResultMessage);
	var elemNoResultSuggestion = document.createElement('a');
	elemNoResultSuggestion.href = '/entry/new';
	elemNoResultSuggestion.innerHTML = 'Create a new entry';
	leftSearchCard.elemNoResult.appendChild(elemNoResultSuggestion);
	leftSearchCard.resultCard = {};
	leftSearchCard.resultCard.element = document.createElement('a');
	var card = document.createElement('li');
	card.className = 'result-card';
	leftSearchCard.resultCard.title = document.createElement('h3');
	leftSearchCard.resultCard.description = document.createElement('p');
	card.appendChild(leftSearchCard.resultCard.title);
	card.appendChild(leftSearchCard.resultCard.description);
	leftSearchCard.resultCard.element.appendChild(card);
	leftSearchCard.searchResult = document.getElementById('left-searchresult');
	leftSearchCard.showSearchResult = function() {
		var result = JSON.parse(this.response);

		// Show no result page
		if (Object.keys(result).length === 0) {
			leftSearchCard.searchResult.innerHTML = '';
			leftSearchCard.searchResult.appendChild(leftSearchCard.elemNoResult);
			return;
		}

		// Put search results into the bar
		leftSearchCard.searchResult.innerHTML = '';
		for (var i = 0; i < result.data.length; i++) {
			leftSearchCard.resultCard.title.innerHTML = result.data[i].entry.title;
			leftSearchCard.resultCard.description.innerHTML = result.data[i].entry.summary[0].description;
			if (leftSearchCard.resultCard.description.innerHTML.length > 0) leftSearchCard.resultCard.description.innerHTML = leftSearchCard.resultCard.description.innerHTML.replace(/\[([^\]]+)\]\((\S+)\)/igm, '$1');
			var currentSlugs = [];
			for (var j = 0; j < entries.length; j++) {
				currentSlugs[entries[j].column] = entries[j].slug;
			}
			leftSearchCard.resultCard.element.href = '/tl/' + result.data[i].entry.slug + '/' + currentSlugs.toString().replace(/,/g, '/') + viewString();
			leftSearchCard.searchResult.appendChild(leftSearchCard.resultCard.element.cloneNode(true));
		}
	};
	leftSearchCard.search = function(text) {
		text = text.trim();
		text = text.replace(/[|&;$%@"<>()+,\\\/\.]/g, '');
		if (!Boolean(text)) return;

		// Show loading page
		leftSearchCard.searchResult.innerHTML = '';
		leftSearchCard.searchResult.appendChild(leftSearchCard.elemLoading);

		// Make request
		var requestSearchEntries = new XMLHttpRequest();
		requestSearchEntries.onload = leftSearchCard.showSearchResult;
		requestSearchEntries.open('GET', '/api/search/entry/' + text, true);
		requestSearchEntries.send();
	};

	// Set left toolbar as an object
	leftbar = {};
	leftbar.element = document.getElementById('left-bar');
	// leftbar.expanded = document.getElementById('left-expanded');
	// leftbar.folded = document.getElementById('left-folded');
	// leftbar.isExpanded = true;
	leftbar.isUp = true;
	leftbar.show = function() {
		leftbar.element.style.webkitTransform = 'translate3d(0,0,0)';
		leftbar.element.style.transform = 'translate3d(0,0,0)';
		leftSearchCard.element.style.webkitTransform = 'translate3d(-' + leftSearchCard.width + 'px,0,0)';
		leftSearchCard.element.style.transform = 'translate3d(-' + leftSearchCard.width + 'px,0,0)';
		leftbar.isUp = true;
		placeEntries();
	};
	leftbar.hide = function() {
		if (leftbar.autoHide) {
			leftbar.autoHide = false;
			window.clearTimeout(leftbar.autoHideTimer);
		}
		leftbar.element.style.webkitTransform = 'translate3d(-' + (LEFTBAR_WIDTH * 1.5) + 'px,0,0)';
		leftbar.element.style.transform = 'translate3d(-' + (LEFTBAR_WIDTH * 1.5) + 'px,0,0)';
		leftSearchCard.element.style.webkitTransform = 'translate3d(-' + (LEFTBAR_WIDTH * 1.5 + leftSearchCard.width) + 'px,0,0)';
		leftSearchCard.element.style.transform = 'translate3d(-' + (LEFTBAR_WIDTH * 1.5 + leftSearchCard.width) + 'px,0,0)';
		leftbar.isUp = false;
		placeEntries();
	};
	leftbar.autoHide = true;
	leftbar.autoHideTimer = window.setTimeout(leftbar.hide, 1500);
	leftbar.icons = {};
	leftbar.icons.search = document.getElementById('left-bar-icon-search');
	leftbar.icons.createNew = document.getElementById('left-bar-icon-add');
	leftbar.icons.reverse = document.getElementById('left-bar-icon-reverse');
	leftbar.icons.toggleFold = document.getElementById('left-bar-icon-fold');
	leftbar.icons.zoomIn = document.getElementById('left-bar-icon-zoom-in');
	leftbar.icons.zoomOut = document.getElementById('left-bar-icon-zoom-out');
	leftbar.icons.gapLess = document.getElementById('left-bar-icon-gap-less');
	leftbar.icons.gapMore = document.getElementById('left-bar-icon-gap-more');
	leftbar.icons.twitter = document.getElementById('left-bar-icon-twitter');
	leftbar.icons.facebook = document.getElementById('left-bar-icon-facebook');

	credits = document.getElementById('credits');

	isOne = entries.length == 1;
};

// Sort tidbits
var sortThings = function(reverse) {
	reverse = reverse || false;

	// Sort every tidbits
	timeDiffMin = Number.MAX_VALUE;
	timeDiffMax = 0;
	tidbits.sort(function(a, b) {
		return reverse ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
	});

	// Calculate minimum and maximum gap between adjacent tidbits
	if (tidbits.length <= 1) {
		timeDiffMin = 0;
		timeDiffMax = 0;
	} else {
		for (var i = 1; i < tidbits.length; i++) {
			var timeDiff = Math.abs(tidbits[i].timestamp - tidbits[i-1].timestamp);
			timeDiffMin = (timeDiffMin < timeDiff || timeDiff == 0) ? timeDiffMin : timeDiff;
			timeDiffMax = timeDiffMax > timeDiff ? timeDiffMax : timeDiff;
		}
	}
};

// Attach some events and transition to elements
var setThings = function() {
	// Entries
	for (var i = 0; i < entries.length; i++) {
		// Set transition for entries
		entries[i].element.style.visibility = 'visible';
		entries[i].element.style.transition = 'all 0.2s ease-out 0s';

		// Shift to the left button
		entries[i].shiftLeft.addEventListener('click', function() {
			if (this.column == 0) {
				this.x -= 16;
				this.place();
				this.placeSticky(viewZoomLevel);
				window.setTimeout(function() {
					this.x += 16;
					this.place();
					this.placeSticky(viewZoomLevel);
				}.bind(this), 50);
				return;
			}
			for (var i = 0; i < entries.length; i++) {
				if (entries[i].column == this.column - 1) {
					entries[i].column = this.column;
					this.column = this.column - 1;
					placeEntries();
					break;
				}
			}

			// Change URL relavently
			var newSlugOrder = [];
			for (var i = 0; i < entries.length; i++) {
				newSlugOrder[entries[i].column] = entries[i].slug;
			}
			var newUrl = '/tl/' + newSlugOrder.toString().replace(/,/g, '/') + viewString();
			window.history.replaceState({ urlPath: newUrl }, '', newUrl);
		}.bind(entries[i]));

		// Shift to the right button
		entries[i].shiftRight.addEventListener('click', function() {
			if (this.column == entries.length - 1) {
				this.x += 16;
				this.place();
				this.placeSticky(viewZoomLevel);
				window.setTimeout(function() {
					this.x -= 16;
					this.place();
					this.placeSticky(viewZoomLevel);
				}.bind(this), 50);
				return;
			}
			for (var i = 0; i < entries.length; i++) {
				if (entries[i].column == this.column + 1) {
					entries[i].column = this.column;
					this.column = this.column + 1;
					placeEntries();
					break;
				}
			}

			// Change URL relavently
			var newSlugOrder = [];
			for (var i = 0; i < entries.length; i++) {
				newSlugOrder[entries[i].column] = entries[i].slug;
			}
			var newUrl = '/tl/' + newSlugOrder.toString().replace(/,/g, '/') + viewString();
			window.history.replaceState({ urlPath: newUrl }, '', newUrl);
		}.bind(entries[i]));

		// Entry history button
		entries[i].history.addEventListener('click', function() {
			var iframe = document.getElementById('revision-history-iframe');
			iframe.src = '/entry/' + this.id + '/history';
			var overlay = document.getElementById('overlay');
			var revisionHistory = document.getElementById('revision-history');
			overlay.style.visibility = 'visible';
			overlay.style.opacity = 1;
			revisionHistory.style.display = 'block';
			window.setTimeout(function() { this.style.opacity = 1; }.bind(revisionHistory), 10);
		}.bind(entries[i]));

		// Edit entry button
		entries[i].edit.addEventListener('click', function() {
			var overlay = document.getElementById('overlay');
			var editEntry = document.getElementById('form-entry');
			overlay.style.visibility = 'visible';
			overlay.style.opacity = 1;
			editEntry.style.display = 'block';
			window.setTimeout(function() { this.style.opacity = 1; }.bind(editEntry), 10);
			document.getElementById('form-entry-info').innerHTML = '<strong>' + this.title + '</strong>';
			document.getElementById('form-entry-form').action = '/entry/' + this.id + '/edit';
			document.getElementById('summary').value = this.summary;
			document.getElementById('note-label-entry').style.display = 'inline-block';
			document.getElementById('note-br-entry').style.display = 'none';
			document.getElementById('note-entry').style.display = 'inline-block';
			document.getElementById('note-entry').required = true;
			document.getElementById('submit-entry').innerHTML = 'Make change';
		}.bind(entries[i]));

		// Add new tidbit button
		entries[i].addNew.addEventListener('click', function() {
			var overlay = document.getElementById('overlay');
			var newTidbit = document.getElementById('form-tidbit');
			overlay.style.visibility = 'visible';
			overlay.style.opacity = 1;
			newTidbit.style.display = 'block';
			window.setTimeout(function() { this.style.opacity = 1; }.bind(newTidbit), 10);
			document.getElementById('form-tidbit-info').innerHTML = 'Add new tidbit for <strong>' + this.title + '</strong>';
			document.getElementById('form-tidbit-form').action = '/entry/' + this.id + '/tidbit/new';
			document.getElementById('title').value = '';
			document.getElementById('description').value = '';
			document.getElementById('year').value = '';
			document.getElementById('month').value = '';
			document.getElementById('date').value = '';
			document.getElementById('hour').value = '';
			document.getElementById('minute').value = '';
			document.getElementById('second').value = '';
			document.getElementById('millisecond').value = '';
			document.getElementById('source').value = '';
			document.getElementById('note-label').style.display = 'none';
			document.getElementById('note-br').style.display = 'none';
			document.getElementById('note').style.display = 'none';
			document.getElementById('note').required = false;
			document.getElementById('submit').innerHTML = 'Create new tidbit';
		}.bind(entries[i]));

		// Close entry button
		entries[i].close.addEventListener('click', function() {
			if (entries.length <= 1) {
				this.y += 16;
				this.place();
				this.placeSticky(viewZoomLevel);
				window.setTimeout(function() {
					this.y -= 16;
					this.place();
					this.placeSticky(viewZoomLevel);
				}.bind(this), 50);
				return;
			}

			// Remove child tidbits from DOM
			for (var i = 0; i < this.tidbits.length; i++) {
				for (var j = 0; j < tidbits.length; j++) {
					if (this.tidbits[i].id == tidbits[j].id) {
						tidbits.splice(j, 1);
						break;
					}
				}
			}

			// Remove this entry and move other entries to make up the space
			for (var i = 0; i < entries.length; i++) {
				if (entries[i].column == this.column) {
					entries.splice(i, 1);
					i--;
					this.y += 100;
					this.place();
					this.placeSticky(viewZoomLevel);
					this.element.style.opacity = 0;
					window.setTimeout(function() {
						this.element.remove();
					}.bind(this), 50);
				} else if (entries[i].column > this.column) {
					entries[i].column -= 1;
				}
			}

			sortThings();
			setTidbitWidth();
			placeEntries(true);
			placeTidbits();

			// Change URL relavently
			var newSlugOrder = [];
			for (var i = 0; i < entries.length; i++) {
				newSlugOrder[entries[i].column] = entries[i].slug;
			}
			var newUrl = '/tl/' + newSlugOrder.toString().replace(/,/g, '/') + viewString();
			window.history.replaceState({ urlPath: newUrl }, '', newUrl);
		}.bind(entries[i]));
	}

	// Related entries
	var relatedLinks = document.getElementsByClassName('related-topic');
	for (var i = 0; i < relatedLinks.length; i++) {
		relatedLinks[i].addEventListener('click', function() {
			var regexCheckExisting = '\/' + this.dataset.slug + '(\/|$)';
			if (window.location.pathname.match(regexCheckExisting)) return;
			window.location.pathname += '/' + this.dataset.slug;
			console.log(window.location.href);
		}.bind(relatedLinks[i]));
	}

	// Tidbits
	for (var i = 0; i < tidbits.length; i++) {
		// Set transition for tidbits
		tidbits[i].element.style.visibility = 'visible';
		tidbits[i].detail.style.visibility = 'visible';
		tidbits[i].element.style.transition = 'all 0.2s ease-out 0s';

		// Click title of the tidbit to hide/show details
		tidbits[i].titleElement.addEventListener('click', function() {
			if (this.isFolded()) {
				this.expand();
			} else {
				this.fold();
			}
			placeTidbits();
		}.bind(tidbits[i]));

		// Tidbit history button
		tidbits[i].history.addEventListener('click', function() {
			var iframe = document.getElementById('revision-history-iframe');
			iframe.src = '/entry/' + this.mom.id + '/tidbit/' + this.id + '/history';
			var overlay = document.getElementById('overlay');
			var revisionHistory = document.getElementById('revision-history');
			overlay.style.visibility = 'visible';
			overlay.style.opacity = 1;
			revisionHistory.style.display = 'block';
			window.setTimeout(function() { this.style.opacity = 1; }.bind(revisionHistory), 10);
		}.bind(tidbits[i]));

		// Edit tidbit button
		tidbits[i].edit.addEventListener('click', function() {
			var overlay = document.getElementById('overlay');
			var newTidbit = document.getElementById('form-tidbit');
			overlay.style.visibility = 'visible';
			overlay.style.opacity = 1;
			newTidbit.style.display = 'block';
			window.setTimeout(function() { this.style.opacity = 1; }.bind(newTidbit), 10);
			document.getElementById('form-tidbit-info').innerHTML = 'Edit tidbit for <strong>' + this.mom.title + '</strong>';
			document.getElementById('form-tidbit-form').action = '/entry/' + this.mom.id + '/tidbit/' + this.id + '/edit';
			document.getElementById('title').value = this.title;
			document.getElementById('description').value = this.description;
			document.getElementById('year').value = 		this.validTime > 0 ? this.timestamp.getUTCFullYear() : '';
			document.getElementById('month').value = 		this.validTime > 1 ? this.timestamp.getUTCMonth()+1 : '';
			document.getElementById('date').value = 		this.validTime > 2 ? this.timestamp.getUTCDate() : '';
			document.getElementById('hour').value = 		this.validTime > 3 ? this.timestamp.getUTCHours() : '';
			document.getElementById('minute').value = 		this.validTime > 4 ? this.timestamp.getUTCMinutes() : '';
			document.getElementById('second').value = 		this.validTime > 5 ? this.timestamp.getUTCSeconds() : '';
			document.getElementById('millisecond').value =	this.validTime > 6 ? this.timestamp.getUTCMilliseconds() : '';
			document.getElementById('source').value = this.source;
			document.getElementById('note-label').style.display = 'inline-block';
			document.getElementById('note-br').style.display = 'inline';
			document.getElementById('note').style.display = 'inline-block';
			document.getElementById('note').required = true;
			document.getElementById('submit').innerHTML = 'Apply change';
		}.bind(tidbits[i]));

		// Remove tidbit button
		tidbits[i].remove.addEventListener('click', function() {
			var overlay = document.getElementById('overlay');
			var removeTidbit = document.getElementById('form-tidbit-remove');
			overlay.style.visibility = 'visible';
			overlay.style.opacity = 1;
			removeTidbit.style.display = 'block';
			window.setTimeout(function() { this.style.opacity = 1; }.bind(removeTidbit), 10);
			document.getElementById('tidbit-remove-note').value = '';
			document.getElementById('form-tidbit-remove-form').action = '/entry/' + this.mom.id + '/tidbit/' + this.id + '/remove';
		}.bind(tidbits[i]));
	}

	// Left bar icons - search and add
	leftbar.icons.search.addEventListener('click', function() {
		leftSearchCard.toggle();
	});

	// Left search bar - search button
	leftSearchCard.searchButton.addEventListener('click', function() {
		leftSearchCard.search(leftSearchCard.searchText.value);
	});

	// Left search bar - pressing return key on text box
	leftSearchCard.searchText.addEventListener('keypress', function(evt) {
		if (evt.keyCode == 13) leftSearchCard.search(this.value);
	});

	// Left bar icons - reverse time
	leftbar.icons.reverse.addEventListener('click', function() {
		reverseTime = !reverseTime;
		sortThings(reverseTime);
		placeTidbits();
		setViews();
	});

	// Left bar icons - toggle fold all
	leftbar.icons.toggleFold.addEventListener('click', function() {
		toggleFold();
		setViews();
	});

	// Left bar icons - zoom in
	leftbar.icons.zoomIn.addEventListener('click', function() {
		viewZoomLevel += 0.1;
		if (viewZoomLevel > VIEW_ZOOM_MAX) viewZoomLevel = VIEW_ZOOM_MAX;
		setZoom(viewZoomLevel);
		setViews();
	});

	// Left bar icons - zoom out
	leftbar.icons.zoomOut.addEventListener('click', function() {
		viewZoomLevel -= 0.1;
		if (viewZoomLevel < VIEW_ZOOM_MIN) viewZoomLevel = VIEW_ZOOM_MIN;
		setZoom(viewZoomLevel);
		setViews();
	});

	// Left bar icons - less gap
	leftbar.icons.gapLess.addEventListener('click', function() {
		tidbitGapLevel -= 1;
		if (tidbitGapLevel < 0) tidbitGapLevel = 0;
		setGap();
		setViews();
	});

	// Left bar icons - more gap
	leftbar.icons.gapMore.addEventListener('click', function() {
		tidbitGapLevel += 1;
		if (tidbitGapLevel >= TIDBIT_GAPS.length) tidbitGapLevel = TIDBIT_GAPS.length - 1;
		setGap();
		setViews();
	});

	// Left bar icons - share via twitter
	leftbar.icons.twitter.addEventListener('click', function() {
		alert('Sharing via Twitter is not available yet :(');
	});

	// Left bar icons - share via facebook
	leftbar.icons.facebook.addEventListener('click', function() {
		alert('Sharing via Facebook is not available yet :(');
	});

	// Scroll event
	window.addEventListener('scroll', function() {
		updateScroller();
		if (isStickyUp) {
			if (window.scrollY < headerHeight) {
				for (var i = 0; i < entries.length; i++) {
					entries[i].sticky.style.opacity = 0;
					entries[i].sticky.style.visibility = 'hidden';
					isStickyUp = false;
				}
			} else {
				for (var i = 0; i < entries.length; i++) {
					entries[i].placeSticky(viewZoomLevel);
				}
			}
		} else {
			if (window.scrollY >= headerHeight) {
				for (var i = 0; i < entries.length; i++) {
					entries[i].sticky.style.opacity = 1;
					entries[i].sticky.style.visibility = 'visible';
					entries[i].placeSticky(viewZoomLevel);
					isStickyUp = true;
				}
			}
		}
	});

	// Resize event
	window.addEventListener('resize', function() {
		updateScroller();
		for (var i = 0; i < entries.length; i++) entries[i].placeSticky(viewZoomLevel);
	});

	// Mouse move event to fold/expand left bar
	window.addEventListener('mousemove', function(evt) {
		if (leftbar.isUp) {
			if (evt.screenX > LEFTBAR_WIDTH * 2 && !leftSearchCard.isUp && !leftbar.autoHide) {
				leftbar.hide();
			}
		} else {
			if (evt.screenX < LEFTBAR_WIDTH * 0.5) {
				leftbar.show();
			}
		}
	});

	// Close buttons
	document.getElementById('form-entry-close').addEventListener('click', function() {
		var overlay = document.getElementById('overlay');
		var editEntry = document.getElementById('form-entry');
		overlay.style.visibility = 'hidden';
		overlay.style.opacity = 0;
		window.setTimeout(function() { this.style.display = 'none'; }.bind(editEntry), 110);
		editEntry.style.opacity = 0;
	});

	document.getElementById('form-tidbit-close').addEventListener('click', function() {
		var overlay = document.getElementById('overlay');
		var newTidbit = document.getElementById('form-tidbit');
		overlay.style.visibility = 'hidden';
		overlay.style.opacity = 0;
		window.setTimeout(function() { this.style.display = 'none'; }.bind(newTidbit), 110);
		newTidbit.style.opacity = 0;
	});

	document.getElementById('form-tidbit-remove-close').addEventListener('click', function() {
		var overlay = document.getElementById('overlay');
		var removeTidbit = document.getElementById('form-tidbit-remove');
		overlay.style.visibility = 'hidden';
		overlay.style.opacity = 0;
		window.setTimeout(function() { this.style.display = 'none'; }.bind(removeTidbit), 110);
		removeTidbit.style.opacity = 0;
	});

	document.getElementById('revision-history-close').addEventListener('click', function() {
		var overlay = document.getElementById('overlay');
		var revisionHistory = document.getElementById('revision-history');
		overlay.style.visibility = 'hidden';
		overlay.style.opacity = 0;
		window.setTimeout(function() { this.style.display = 'none'; }.bind(revisionHistory), 110);
		revisionHistory.style.opacity = 0;

		var iframe = document.getElementById('revision-history-iframe');
		iframe.src = '';
	});

	leftSearchCard.closeButton.addEventListener('click', function() {
		leftSearchCard.putBack();
	});
};

// Place entries
var placeEntries = function(setHeight) {
	setHeight = setHeight || false;
	isOne = entries.length == 1;
	if (setHeight) headerHeight = 0;

	// Place entries side by side
	for (var i = 0; i < entries.length; i++) {
		entries[i].element.style.width = (isOne ? ARTICLE_WIDTH_SINGLE : ARTICLE_WIDTH_MULTI) + 'px';
		entries[i].sticky.style.width = ((isOne ? ARTICLE_WIDTH_SINGLE : ARTICLE_WIDTH_MULTI) - help.em2px(ENTRY_MARGIN_INBETWEEN, entries[i].sticky) * 3 + 1) + 'px';
		entries[i].y = help.em2px(ENTRY_MARGIN_TOP, entries[i].element);
		// entries[i].x = entries[i].column * ARTICLE_WIDTH_MULTI + help.em2px(entries[i].column * ENTRY_MARGIN_INBETWEEN + ENTRY_MARGIN_LEFT, entries[i].element) + (leftbar.isExpanded ? LEFTBAR_WIDTH_EXPANDED : LEFTBAR_WIDTH_FOLDED);
		entries[i].x = entries[i].column * ARTICLE_WIDTH_MULTI + help.em2px(entries[i].column * ENTRY_MARGIN_INBETWEEN + ENTRY_MARGIN_LEFT, entries[i].element) + (leftbar.isUp ? LEFTBAR_WIDTH : help.em2px((viewZoomLevel - 1) * 2.5, timelineView)) + (leftSearchCard.isUp ? leftSearchCard.width : 0);
		if (setHeight) headerHeight = headerHeight > entries[i].header.offsetHeight ? headerHeight : entries[i].header.offsetHeight;
	}

	// Set common height for headers, icons, and MOVE!
	for (var i = 0; i < entries.length; i++) {
		if (setHeight) entries[i].header.style.height = headerHeight + 'px';
		entries[i].element.getElementsByClassName('entry-iconset')[0].style.right = '0.2em';
		entries[i].element.getElementsByClassName('entry-iconset')[0].style.top = '0.2em';
		entries[i].place();
		entries[i].placeSticky(viewZoomLevel);
	}

	// Set sidebar appearance
	// leftbar.element.style.width = (leftbar.isExpanded ? LEFTBAR_WIDTH_EXPANDED : LEFTBAR_WIDTH_FOLDED) + 'px';

	// Set scroller
	updateScroller();
	window.setTimeout(function() {
		updateScroller();
		window.setTimeout(function() {
			updateScroller();
		}, 100);
	}, 100);
};

var updateScroller = function() {
	// Set scrollbar appearance
	// scrollbar.style.left = (leftbar.isExpanded ? LEFTBAR_WIDTH_EXPANDED : LEFTBAR_WIDTH_FOLDED) + 'px';
	// scrollbar.style.width = 'calc(100% - ' + (leftbar.isExpanded ? LEFTBAR_WIDTH_EXPANDED : LEFTBAR_WIDTH_FOLDED) + 'px)';
	scrollbar.style.left = (leftbar.isUp ? LEFTBAR_WIDTH : 0) + 'px';
	scrollbar.style.width = 'calc(100% - ' + (leftbar.isUp ? LEFTBAR_WIDTH : 0) + 'px)';
	if (window.scrollMaxX != undefined) {	// Damn Firefox
		scroller.style.width = (scrollbar.offsetWidth * document.body.clientWidth / (window.scrollMaxX + document.body.clientWidth)) + 'px';
		scroller.style.left = help.map(window.scrollX, 0, document.body.clientWidth, 0, scrollbar.offsetWidth) + 'px';
	} else {
		scroller.style.width = (scrollbar.offsetWidth * document.body.clientWidth / document.body.scrollWidth) + 'px';
		scroller.style.left = help.map(document.body.scrollLeft, 0, document.body.clientWidth, 0, scrollbar.offsetWidth) + 'px';
	}
};

var setTidbitWidth = function() {
	// Set width of the tidbit and max-width of the content in case of having long text
	isOne = entries.length == 1;
	for (var i = 0; i < tidbits.length; i++) {
		tidbits[i].element.style.width = (isOne ? ARTICLE_WIDTH_SINGLE : ARTICLE_WIDTH_MULTI) + 'px';
		tidbits[i].content.style.maxWidth = ((isOne ? ARTICLE_WIDTH_SINGLE : ARTICLE_WIDTH_MULTI) - tidbits[i].content.offsetLeft - help.em2px(2, tidbits[i].content)) + 'px';
	}
}

// Place tidbits
var placeTidbits = function() {
	if (tidbits.length <= 0) return;

	// Calculate right vertical position and place it right
	var lastInColumn = [];
	var extraGap = [];
	for (var i = 0; i < entries.length; i++) {
		extraGap[i] = 0;
	}
	tidbits[0].y = help.em2px(TIDBIT_BUFFER_HEADER, tidbits[0].element);
	tidbits[0].place();
	lastInColumn[tidbits[0].mom.column] = tidbits[0];
	for (var i = 1; i < tidbits.length; i++) {
		var timeDiff = Math.abs(tidbits[i].timestamp - tidbits[i-1].timestamp);
		var gap = timeDiff == 0 ? 0 : (timeDiffMin == timeDiffMax ? TIDBIT_GAP_MIN : help.map(timeDiff, timeDiffMin, timeDiffMax, TIDBIT_GAP_MIN, TIDBIT_GAP_MAX));
		gap = help.em2px(gap, tidbits[i].element);
		var lastOne = lastInColumn[tidbits[i].mom.column];
		if (lastOne != undefined) {
			var offset = lastOne.isFolded() ? lastOne.detail.offsetHeight : 0;
			if (lastOne.y + lastOne.element.offsetHeight - offset > tidbits[i-1].y + gap) {
				for (var j = 0; j < entries.length; j++) {
					extraGap[j] = (lastOne.y + lastOne.element.offsetHeight - offset) - (tidbits[i-1].y + gap);
				}
			}
			if (extraGap[tidbits[i].mom.column] > 0) {
				tidbits[i].y = tidbits[i-1].y + gap + extraGap[tidbits[i].mom.column];
				extraGap[tidbits[i].mom.column] = 0;
				for (var j = i - 1; j >= 0; j--) {
					if (tidbits[i].timestamp - tidbits[j].timestamp == 0) {
						if (tidbits[j].mom.column != tidbits[i].mom.column) {
							tidbits[j].y = tidbits[i].y;
							tidbits[j].place();
						}
					} else {
						break;
					}
				}
			} else {
				tidbits[i].y = tidbits[i-1].y + gap;
			}
		} else {
			tidbits[i].y = tidbits[i-1].y + gap;
		}
		lastInColumn[tidbits[i].mom.column] = tidbits[i];
		tidbits[i].place();
	}

	// Resize article height and place vertical line
	var setArticleHeight = function() {
		var timestampSample = document.getElementsByClassName('timestamp')[0];
		var lineBufferLeft = timestampSample.offsetWidth + timestampSample.offsetLeft;
		for (var i = 0; i < entries.length; i++) {
			var last = tidbits.length - 1;
			for (var j = last; j >= 1; j--) {
				if (tidbits[j].timestamp - tidbits[j-1].timestamp != 0) break;
				last = (tidbits[last].y + tidbits[last].element.offsetHeight) > (tidbits[j-1].y + tidbits[j-1].element.offsetHeight) ? last : j-1;
			}
			entries[i].element.style.height = (tidbits[last].y + tidbits[last].element.offsetHeight + help.em2px(ENTRY_MARGIN_BOTTOM, entries[i].element) + headerHeight) + 'px';

			if (lastInColumn[i] != undefined) {
				var vLine = entries[i].element.getElementsByClassName('line')[0];
				vLine.style.width = viewZoomLevel > 0.7 ? '1px' : '1.5px';
				vLine.style.left = (lineBufferLeft + 8) + 'px';
				vLine.style.height = (lastInColumn[i].y + lastInColumn[i].element.offsetHeight * 0.7) + 'px';
			}
		}

		// Place credits div
		credits.style.left = ((leftbar.isUp ? LEFTBAR_WIDTH : help.em2px((viewZoomLevel - 1) * 2.5, timelineView)) + help.em2px(1, credits)) + 'px';
		credits.style.top = (entries[0].element.offsetTop + entries[0].element.offsetHeight + help.em2px(2, credits)) + 'px';
	};
	setArticleHeight();
	window.setTimeout(setArticleHeight, 200);
};

// Start!
document.onreadystatechange = function() {
	if (document.readyState == 'interactive') {
		// Do stuffs that might change the layout of elements, to ensure placing is done right
		getViews();
		getThings();
		sortThings(reverseTime);
		setTidbitWidth();
	} else if (document.readyState == 'complete') {
		// Place 
		placeEntries(true);
		placeTidbits();

		// Attach event listneres and animations once everything's in place
		setThings();

		applyViews();
	}
};