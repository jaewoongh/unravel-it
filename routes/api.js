module.exports = function(mongoose, db) {
	var MAX_RECENT_ENTRY = 100;
	var USER_TESTER = new mongoose.Types.ObjectId('5544907925288cde3905e0d1');
	var USER_ADMIN = new mongoose.Types.ObjectId('554490b425288cde3905e0d3');

	/*****************************
	* DIRECT REQUEST FROM CLIENT *
	*****************************/

	// Search entries
	var searchEntries = function(req, res) {
		var searchString = req.params.string;
		if (!Boolean(searchString)) return res.json({});

		// Tokenize string
		var tokens = searchString.split(' ');

		// Check exclude tokens
		var tokensToExclude = [];
		for (var i = 0; i < tokens.length; i++) {
			var matchResult = tokens[i].match(/^\-(\S+)/);
			if (matchResult !== null) {
				tokens.splice(i, 1);
				tokensToExclude.push(matchResult[1]);
				i--;
			}
		}
		if (tokens.length <= 0) return res.json({});

		// Make a loose RegExp for initial search
		var regexString = '';
		var regexWordMatchString = '';
		for (var i = 0; i < tokens.length; i++) {
			regexString += tokens[i] + '|';
			regexWordMatchString += '(^|\\s)' + tokens[i] + '(\\s|$)|';
		}
		var regex = new RegExp(regexString.slice(0, -1), 'ig');
		var regexWord = new RegExp(regexWordMatchString.slice(0, -1), 'ig');

		var regexStringExclude = '';
		for (var i = 0; i < tokensToExclude.length; i++) {
			regexStringExclude += tokensToExclude[i] + '|';
		}
		var regexExclude = new RegExp(regexStringExclude.slice(0, -1), 'ig');
		console.log('Entry search request: ' + regexString.slice(0, -1) + (regexStringExclude.length > 0 ? ' -(' + regexStringExclude.slice(0, -1) + ')' : ''));

		// Begin search
		db.Entry.find({title: regex, status: 'published'}, function(err, entries) {
			if (err) return console.error(err);

			// Make final result
			var result = [];
			for (var i = 0; i < entries.length; i++) {
				// Exclude
				if (tokensToExclude.length > 0) {
					if (entries[i].title.match(regexExclude) !== null) {
						entries.splice(i, 1);
						i--;
						continue;
					}
				}

				// Add basic relevance points
				var one = {};
				one.point = entries[i].title.match(regex).length;

				// Weigh whole-word-match more
				var wordMatchResult = entries[i].title.match(regexWord);
				if (wordMatchResult !== null) {
					one.point += wordMatchResult.length * 10;
				}
				one.entry = entries[i];
				result.push(one);
			}

			// Sort final result
			result.sort(function(a, b) {
				return b.point - a.point;
			});

			// Send the result
			if (result.length > 0) res.json({data: result});
			else res.json({});
		});
	};

	// Get recently edited entries
	var recentlyEditedEntries = function(req, res) {
		var howMany = parseInt(req.params.num);
		if (!Boolean(howMany)) return res.json({});

		// Fetch list data
		db.List.findOne().exec(function(err, list) {
			if (err) return console.error(err);
			if (!Boolean(list)) return res.json({});
			list.recentlyEditedEntries.sort(function(a, b) {
				return b.lastEdit - a.lastEdit;
			});
			res.json({data: list.recentlyEditedEntries.slice(0, howMany)});
		});
	};

	// Admin API - entry list
	var adminEntryList = function(req, res) {
		db.Entry.find({}, function(err, entries) {
			if (err) return res.json({});
			res.json({data: entries});
		});
	};

	// Admin API - remove entry
	var adminRemoveEntry = function(req, res) {
		var docId = req.params.docId;
		if (!Boolean(docId)) return res.json({});

		removeEntry(docId, {id: USER_ADMIN, ip: req.ip}, 'Removed via admin api call', function(removedEntry) {
			res.json({data: removedEntry});
		});
	};


	/************************
	* INDEPENDENT FUNCTIONS *
	************************/

	// Get revision history of an entry
	var getRevisionHistoryOfEntry = function(entry, callback, options) {
		options = options || {};
		options.includeCurrent = options.includeCurrent || true;
		options.includeChildren = options.includeChildren || true;
		if (options.includeChildren) {
			db.History.find(
				{ momId: entry._id },
				function(err, histories) {
					if (err) return [];
					if (options.includeCurrent) {
						histories.push(entry.summary[0]);
						histories = histories.concat(entry.tidbits);
					}
					histories.sort(function(a, b) {
						return (b.timeOfCreation || b._id.getTimestamp()) - (a.timeOfCreation || a._id.getTimestamp());
					});
					if (typeof callback === 'function') callback(histories);
					return histories;
			});
		} else {
			db.History.find(
				{ momId: entry._id, $or: [{type: 'entry-creation'}, {type: 'entry-summary'}, {type: 'entry-removal'}] },
				null,
				{ sort: { timeOfCreation: -1 } },
				function(err, histories) {
					if (err) return null;
					if (options.includeCurrent) histories.unshift(entry.summary[0]);
					if (typeof callback === 'function') callback(histories);
					return histories;
			});
		}
	};

	// Get revision history of a tidbit
	var getRevisionHistoryOfTidbit = function(tidbit, callback, options) {
		options = options || {};
		options.includeCurrent = options.includeCurrent || true;
		db.History.find(
			{ docId: tidbit.docId },
			null,
			{ sort: { v: -1 } },
			function(err, histories) {
				if (err) return null;
				if (options.includeCurrent) histories.unshift(tidbit);
				if (typeof callback === 'function') callback(histories);
				return histories;
		});
	};

	// Update recently edited entries list
	var updateRecentlyEditedEntries = function(entry, callback) {
		db.List.findOne({}, {'recentlyEditedEntries': 1}, function(err, list) {
			if (err) return null;
			if (!Boolean(list)) list = new db.List();
			if (!Boolean(list.recentlyEditedEntries)) list.recentlyEditedEntries = [];

			for (var i = 0; i < list.recentlyEditedEntries.length; i++) {
				if (list.recentlyEditedEntries[i].slug == entry.slug) list.recentlyEditedEntries.splice(i, 1);
			}
			list.recentlyEditedEntries.unshift({
				title:		entry.title,
				slug:		entry.slug,
				docId:		entry._id,
				status:		entry.status,
				lastEdit:	entry.lastmodified
			});
			list.recentlyEditedEntries.splice(MAX_RECENT_ENTRY);
			list.save(function(err, updatedList) {
				if (err) return null;
				if (typeof callback === 'function') callback(updatedList);
				return updatedList;
			});
		});
	};

	// Remove entry
	var removeEntry = function(docId, user, note, callback) {
		db.Entry.findOne({ _id: docId }, function(err, entry) {
			if (err) return null;
			if (entry.status === 'removed') return null;

			// Create history
			var removeHistory = new db.History({
				timeOfCreation:	new Date(),
				docId:			new mongoose.Types.ObjectId,
				v:				0,
				momId:			entry._id,
				type:			'entry-removal',
				editorId:		user.id,
				editorIp:		user.ip,
				related:		[],
				note:			note,
				title:			entry.title,
				status:			'published'
			});
			removeHistory.save(function(err, history) {
				if (err) return null;
				entry.status = 'removed';
				entry.save(function(err, removedEntry) {
					if (err) return null;
					updateRecentlyEditedEntries(removedEntry, function(updatedList) {
						if (typeof callback === 'function') callback(removedEntry);
						return removedEntry;
					});
				});
			});
		});
	};

	// Remove tidbit
	var removeTidbit = function(docId, bitId, user, note, callback) {
		db.Entry.findOne({ _id: docId }, function(err, entry) {
			if (err) return null;
			if (entry.status === 'removed') return null;

			// Find and remove-flag tidbit
			for (var i = 0; i < entry.tidbits.length; i++) {
				if (entry.tidbits[i].docId != bitId) continue;

				// Move old tidbit to history
				var oldTidbit = entry.tidbits[i].toObject();
				delete oldTidbit._id;
				var history = new db.History(oldTidbit);
				history.timeOfCreation = entry.tidbits[i]._id.getTimestamp();
				history.save(function(err, savedHistory) {
					if (err) console.error(err);
					if (err) return null;

					// Create new tidbit
					var newTidbit = new db.Tidbit({
						docId:			entry.tidbits[i].docId,
						v:				entry.tidbits[i].v + 1,
						momId:			entry._id,
						type:			'tidbit-removal',
						editorId:		user.id,
						editorIp:		user.ip,
						note:			note,
						title:			entry.tidbits[i].title,
						description:	entry.tidbits[i].description,
						source:			entry.tidbits[i].source,
						timestamp:		entry.tidbits[i].timestamp,
						validTime:		entry.tidbits[i].validTime,
						status:			'removed'
					});

					// Replace tidbit and save the entry
					entry.tidbits.splice(i, 1, newTidbit);
					entry.lastmodified = new Date();
					entry.save(function(err, replacedEntry) {
						if (err) return console.error(err);
						updateRecentlyEditedEntries(replacedEntry, function(updatedList) {
							if (typeof callback === 'function') callback(newTidbit);
							return newTidbit;
						});
					});
				});
				break;
			}
		});
	};

	return {
		searchEntries:					searchEntries,
		recentlyEditedEntries:			recentlyEditedEntries,

		getRevisionHistoryOfEntry:		getRevisionHistoryOfEntry,
		getRevisionHistoryOfTidbit:		getRevisionHistoryOfTidbit,

		updateRecentlyEditedEntries:	updateRecentlyEditedEntries,

		removeEntry:					removeEntry,
		removeTidbit:					removeTidbit,

		adminEntryList:					adminEntryList,
		adminRemoveEntry:				adminRemoveEntry
	}
};