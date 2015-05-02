var resultSlip;
var elemLoading;
var elemLoadingIcon;
var elemNoResult;
var elemResult;
var resultCard;

var setThings = function() {
	resultSlip =  document.getElementById('result');
	resultSlip.addEventListener('mousewheel', function(evt) {
		if (Math.abs(evt.wheelDeltaX) < 10) {
			this.scrollLeft -= (evt.wheelDeltaY * 0.8);
			event.preventDefault();
		}
	});

	elemLoading = document.createElement('div');
	elemLoadingIcon = document.createElement('img');
	elemLoadingIcon.src = '/assets/images/icon-loading-32.gif';
	elemLoadingIcon.style.width = '16px';
	elemLoadingIcon.style.height = '16px';
	elemLoadingIcon.style.margin = '6em 0';
	elemLoading.appendChild(elemLoadingIcon);

	elemNoResult = document.createElement('div');
	var elemNoResultMessage = document.createElement('h3');
	elemNoResultMessage.innerHTML = 'No search result :(';
	elemNoResult.appendChild(elemNoResultMessage);
	var elemNoResultSuggestion = document.createElement('a');
	elemNoResultSuggestion.href = '/entry/new';
	elemNoResultSuggestion.innerHTML = 'Create a new entry';
	elemNoResult.appendChild(elemNoResultSuggestion);

	elemResult = document.getElementById('result');

	resultCard = {};
	resultCard.element = document.createElement('a');
	var card = document.createElement('li');
	card.className = 'result-card';
	resultCard.title = document.createElement('h3');
	resultCard.description = document.createElement('p');
	card.appendChild(resultCard.title);
	card.appendChild(resultCard.description);
	resultCard.element.appendChild(card);
};

var loadRecentItems = function() {
	var requestRecentItems = new XMLHttpRequest();
	requestRecentItems.onload = function() {
		var elemRecent = document.getElementById('recent');
		elemRecent.innerHTML = '';
		var elemRecentTitle = document.createElement('span');
		elemRecentTitle.className = 'title';
		elemRecentTitle.innerHTML = 'Recently Edited';
		elemRecent.appendChild(elemRecentTitle);

		var result = JSON.parse(this.response);
		if (Object.keys(result).length === 0) return;
		for (var i = 0; i < result.data.length; i++) {
			if (result.data[i].status !== 'published') continue;
			var item = document.createElement('a');
			item.className = 'recent-item';
			item.href = '/tl/' + result.data[i].slug;
			item.innerHTML = result.data[i].title;
			elemRecent.appendChild(item);
		}
	};
	requestRecentItems.open('GET', '/api/recent/edited-entries/10', true);
	requestRecentItems.send();
};

var enableSearchForm = function() {
	var searchText = document.getElementById('search-text');
	searchText.addEventListener('keypress', function(evt) {
		if (evt.keyCode == 13) search(this.value);
	});

	var searchButton = document.getElementById('search-button');
	searchButton.addEventListener('click', function() {
		search(this.value);
	}.bind(searchText));
};

var search = function(text) {
	text = text.trim();
	text = text.replace(/[|&;$%@"<>()+,\\\/\.]/g, '');
	if (!Boolean(text)) return;

	// Show loading page
	resultSlip.style.visibility = 'visible';
	resultSlip.style.padding = '1em';
	resultSlip.style.height = '13.5em';
	resultSlip.innerHTML = '';
	resultSlip.appendChild(elemLoading);

	// Make request
	var requestSearchEntries = new XMLHttpRequest();
	requestSearchEntries.onload = showSearchResult;
	requestSearchEntries.open('GET', '/api/search/entry/' + text, true);
	requestSearchEntries.send();
};

var slipAnimation;
var showSearchResult = function() {
	window.clearTimeout(slipAnimation);
	var result = JSON.parse(this.response);

	// Show no result page
	if (Object.keys(result).length === 0) {
		resultSlip.style.visibility = 'visible';
		resultSlip.style.padding = '1em';
		resultSlip.style.height = '6.5em';
		resultSlip.innerHTML = '';
		resultSlip.appendChild(elemNoResult);
		slipAnimation = window.setTimeout(function() {
			resultSlip.style.visibility = 'hidden';
			resultSlip.style.padding = '0 1em 0';
			resultSlip.style.height = '0';
		}.bind(resultSlip), 5000);
		return;
	}

	// Put search result into the page
	elemResult.innerHTML = '';
	for (var i = 0; i < result.data.length; i++) {
		resultCard.title.innerHTML = result.data[i].entry.title;
		resultCard.title.title = result.data[i].entry.title;
		resultCard.description.innerHTML = result.data[i].entry.summary[0].description;
		resultCard.description.title = result.data[i].entry.summary[0].description;
		resultCard.element.href = '/tl/' + result.data[i].entry.slug;
		elemResult.appendChild(resultCard.element.cloneNode(true));
	}

	resultSlip.style.visibility = 'visible';
	resultSlip.style.padding = '1em';
	resultSlip.style.borderWidth = '1px';
	resultSlip.style.height = '13.5em';
};

window.onload = function() {
	setThings();
	enableSearchForm();
	loadRecentItems();
};