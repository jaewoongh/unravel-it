module.exports = function(mongoose, db, slug, api) {
	var USER_TESTER = new mongoose.Types.ObjectId('5544907925288cde3905e0d1');

	// Show timeline(s)
	var show = function(req, res) {
		// Fuction for retrieving requested data
		var data = [];
		var load = function(entries, n) {
			db.Entry.findOne({ slug: entries[n] }, function(err, entry) {
				if (err) {
					res.send('Invalid entry requested');
					return console.error(err);
				}
				if (Boolean(entry)) data.push(entry);

				// Recursively get data
				if (++n < entries.length) {
					load(entries, n);
				} else {
					// Check if there is no result
					if (data.length <= 0) return res.status(404).render('404');

					// When done getting data, add relation points
					for (var i = 0; i < data.length - 1; i++) {
						for (var j = i + 1; j < data.length; j++) {
							var found = false;
							if (!Boolean(data[i].related)) data[i].related = [];
							for (var k = 0; k < data[i].related.length; k++) {
								if (data[i].related[k].slug == data[j].slug) {
									data[i].related[k].point += 1;
									if (!Boolean(data[j].related)) data[j].related = [];
									for (var l = 0; l < data[j].related.length; l++) {
										if (data[j].related[l].slug == data[i].slug) {
											data[j].related[l].point += 1;
											break;
										}
									}
									found = true;
									break;
								}
							}
							if (!found) {
								data[i].related.push({
									title:	data[j].title,
									slug:	data[j].slug,
									point:	1
								});
								data[j].related.push({
									title:	data[i].title,
									slug:	data[i].slug,
									point:	1
								});
							}
						}
						data[i].save(function(err, updatedEntry) {
							if (err) return console.error(err);
						});
					}
					if (data.length > 1) {
						data[data.length - 1].save(function(err, updatedEntry) {
							if (err) return console.error(err);
						});
					}

					// Render timeline
					return res.render('timeline', { entry: data });
				}
			});
		};

		// Request as many entries given in the url
		var p = req.params[0].split('/').filter(Boolean);
		var uniq = p.filter(function(elem, pos) {
			return p.indexOf(elem) === pos;
		});
		load(uniq, 0);
	};

	// New entry page
	var newEntry = function(req, res) {
		res.render('newentry', {});
	};

	// Create new entry
	var createEntry = function(req, res) {
		// Inspect given input
		if (!Boolean(req.body.title.trim())) {
			res.render('newentry', { error: "Wait, what was the title?" });
		} else {
			console.log('New entry creation requested.');
			var entryId = new mongoose.Types.ObjectId;
			var summaryId = new mongoose.Types.ObjectId;
			var timestamp = summaryId.getTimestamp();

			// Create summary Tidbit
			var summary = new db.Tidbit({
				docId:			summaryId,
				v:				0,
				momId:			entryId,
				type:			'entry-summary',
				editorId:		USER_TESTER,
				editorIp:		req.ip,
				note:			'First creation',
				title:			req.body.title.trim(),
				description:	req.body.summary.trim(),
				timestamp:		undefined,
				status:			'published'
			});

			// Create "New Entry" marker history tidbit
			var newMarker = new db.History({
				timeOfCreation:	new Date(entryId.getTimestamp() - 1000),
				docId:			new mongoose.Types.ObjectId,
				v:				0,
				momId:			entryId,
				type:			'entry-creation',
				editorId:		USER_TESTER,
				editorIp:		req.ip,
				related:		[],
				note:			'First creation',
				title:			req.body.title.trim(),
				status:			'published'
			});

			// Create new Entry with summary and marker tidbit
			var newEntry = new db.Entry({
				_id:			entryId,
				title:			req.body.title.trim(),
				slug:			slug(req.body.title.trim()).toLowerCase(),
				creatorId:		USER_TESTER,
				summary:		[ summary ],
				tidbits:		[],
				lastmodified:	timestamp,
				status:			'published'
			});

			// Save it
			var save = function(n) {
				newEntry.save(function(err, entry) {
					if (err) {
						// Duplicate key error
						if (err.code === 11000) {
							var errField = err.message.split('.$')[1].split(' dup key')[0];
							errField = errField.substring(0, errField.lastIndexOf('_'));

							// Make different slug
							if (errField === 'slug') {
								if (n == undefined) n = 1;
								newEntry.slug = slug(req.body.title.trim() + ' ' + n.toString());
								save(++n);
							} else {
								console.log('Duplicate key error while creating new entry: ' + errField, err);
								return res.send('The ' + errField + ' already exists :(');
							}
						}
						return console.error(err);
					}
					console.log('New entry has been created: ' + entry.slug + ' (' + entry._id + ')');
					newMarker.save(function(err, history) {
						if (err) return console.error(err);
						console.log('New entry marker has been added to history: ' + history._id);

						// Update the list
						api.updateRecentlyEditedEntries(entry, function(updatedList) {
							res.redirect('/tl/' + entry.slug);
						});
					});
				});
			}
			save();
		}
	};

	// Edit entry
	var editEntry = function(req, res) {
		if (!Boolean(req.body.note.trim())) return res.redirect('back');

		// Get current version of entry
		db.Entry.findOne(
			{ _id: req.params.docId },
			function(err, result) {
				if (err) return console.error(err);
				if (result.summary.length > 0) {
					console.log('Entry editing requested: ', result._id);
					var summary = result.summary[0].toObject();
					delete summary._id;

					// New summary
					var newSummary = new db.Tidbit({
						docId:			summary.docId,
						v:				summary.v + 1,
						momId:			req.params.docId,
						type:			'entry-summary',
						editorId:		USER_TESTER,
						editorIp:		req.ip,
						note:			req.body.note.trim(),
						title:			summary.title,
						description:	req.body.summary.trim(),
						timestamp:		undefined,
						status:			'published'
					});

					// Check if anything is actually updated
					var isUpdated = function(a, b) {
						if (a.description != b.description) return true;
						return false;
					};
					if (!isUpdated(summary, newSummary)) {
						console.log('There was no actual change.');
						return res.redirect('back');
					}

					// Copy current version into history
					var history = new db.History(summary);
					history.timeOfCreation = new Date(result.summary[0]._id.getTimestamp());
					history.save(function(err, history) {
						if (err) return console.error(err);
						console.log('Existing entry successfully copied to history: ', history._id);

						// Replace current version
						result.summary = [newSummary];
						result.lastmodified = new Date();
						result.save(function(err, replacedEntry) {
							if (err) return console.error(err);
							api.updateRecentlyEditedEntries(replacedEntry, function(updatedList) {
								res.redirect('back');
							});
						});
					});
				} else {
					res.redirect('back');
				}
		});
	};

	// Entry history
	var entryHistory = function(req, res) {
		db.Entry.findOne({ _id: req.params.docId }, function(err, result) {
			if (err) return console.error(err);
			api.getRevisionHistoryOfEntry(result, function(history) {
				res.render('history_entry', { history: history });
			});
		});
	};

	// Create timestamp
	var createTimestamp = function(req) {
		var timestamp, validTime;
		if (req.body.month != '') {
			if (req.body.date != '') {
				if (req.body.hour != '') {
					if (req.body.minute != '') {
						if (req.body.second != '') {
							if (req.body.millisecond != '') {
								timestamp = new Date(Date.UTC(req.body.year, parseInt(req.body.month)-1, req.body.date, req.body.hour, req.body.minute, req.body.second, req.body.millisecond));
								validTime = 7;
							} else {
								timestamp = new Date(Date.UTC(req.body.year, parseInt(req.body.month)-1, req.body.date, req.body.hour, req.body.minute, req.body.second));
								validTime = 6;
							}
						} else {
							timestamp = new Date(Date.UTC(req.body.year, parseInt(req.body.month)-1, req.body.date, req.body.hour, req.body.minute));
							validTime = 5;
						}
					} else {
						timestamp = new Date(Date.UTC(req.body.year, parseInt(req.body.month)-1, req.body.date, req.body.hour));
						validTime = 5;
					}
				} else {
					timestamp = new Date(Date.UTC(req.body.year, parseInt(req.body.month)-1, req.body.date));
					validTime = 3;
				}
			} else {
				timestamp = new Date(Date.UTC(req.body.year, parseInt(req.body.month)-1));
				validTime = 2;
			}
		} else {
			timestamp = new Date(Date.UTC(req.body.year, 0));
			validTime = 1;
		}

		return {
			timestamp:	timestamp,
			validTime:	validTime
		}
	};

	// Create new tidbit
	var createTidbit = function(req, res) {
		if (!Boolean(req.body.title.trim()) || !Boolean(req.body.year) || !Boolean(req.body.source.trim())) return res.redirect('back');

		console.log('New tidbit requested.');
		var newTidbit = new db.Tidbit({
			docId:			new mongoose.Types.ObjectId,
			v:				0,
			momId:			req.params.docId,
			type:			'tidbit',
			editorId:		USER_TESTER,
			editorIp:		req.ip,
			note:			'First creation',
			title:			req.body.title.trim(),
			description:	req.body.description.trim(),
			media:			req.body.media,
			mediaType:		req.body.mediaType,
			source:			req.body.source.trim(),
			timestamp:		createTimestamp(req).timestamp,
			validTime:		createTimestamp(req).validTime,
			status:			'published'
		});

		db.Entry.findOne({ _id: req.params.docId }, function(err, entry) {
			if (err) return console.error(err);
			entry.tidbits.push(newTidbit);
			entry.lastmodified = new Date();
			entry.save(function(err, updatedEntry) {
				if (err) return console.error(err);
				console.log('Tidbit successfully added to ' + req.params.docId);

				// Update the list
				api.updateRecentlyEditedEntries(entry, function(updatedList) {
					res.redirect('back');
				});
			});
		});
	};

	// Edit tidbit
	var editTidbit = function(req, res) {
		if (!Boolean(req.body.title.trim()) || !Boolean(req.body.year) || !Boolean(req.body.source.trim()) || !Boolean(req.body.note.trim())) res.redirect('back');

		// Find entry first
		db.Entry.findOne({ _id: req.params.docId }, function(err, entry) {
			if (err) return console.error(err);

			// Find the tidbit
			for (var i = 0; i < entry.tidbits.length; i++) {
				if (entry.tidbits[i].docId == req.params.bitId) {
					// Create new tidbit
					var newTidbit = new db.Tidbit({
						docId:			entry.tidbits[i].docId,
						v:				entry.tidbits[i].v + 1,
						momId:			entry._id,
						type:			'tidbit',
						editorId:		USER_TESTER,
						editorIp:		req.ip,
						note:			req.body.note.trim(),
						title:			req.body.title.trim(),
						description:	req.body.description.trim(),
						source:			req.body.source.trim(),
						timestamp:		createTimestamp(req).timestamp,
						validTime:		createTimestamp(req).validTime,
						status:			entry.tidbits[i].status
					});

					// Check if anything is actually updated
					var isUpdated = function(a, b) {
						if (a.title != b.title) return true;
						if (a.description != b.description) return true;
						// if (a.media != b.media) return true;
						// if (a.mediaType != b.mediaType) return true;
						if (a.source != b.source) return true;
						if (a.timestamp - b.timestamp != 0) return true;
						if (a.validTime != b.validTime) return true;
						return false;
					};
					if (!isUpdated(entry.tidbits[i], newTidbit)) {
						console.log('Nothing really has been changed.');
						return res.redirect('back');
					}

					// Copy current version of tidbit into history collection
					var oldTidbit = entry.tidbits[i].toObject();
					delete oldTidbit._id;
					var history = new db.History(oldTidbit);
					history.timeOfCreation = new Date(entry.tidbits[i]._id.getTimestamp());
					history.save(function(err, history) {
						if (err) return console.error(err);
						console.log('Existing tidbit has successfully been copied to history: ', history._id);

						// Replace current version of tidbit
						entry.tidbits.splice(i, 1, newTidbit);
						entry.lastmodified = new Date();
						entry.save(function(err, replacedEntry) {
							if (err) return console.error(err);
							api.updateRecentlyEditedEntries(replacedEntry, function(updatedList) {
								res.redirect('back');
							});
						});
					});
					return;
				}
			}
			res.redirect('back');
		});
	};

	// Remove tidbit
	var removeTidbit = function(req, res) {
		var note = req.body.note.trim();
		if (!Boolean(note)) return res.redirect('back');
		if (note.length < 2) return res.redirect('back');
		api.removeTidbit(req.params.docId, req.params.bitId, {id: USER_TESTER, ip: req.ip}, note, function(removedTidbit) {
			res.redirect('back');
		});
	};

	// Tidbit history
	var tidbitHistory = function(req, res) {
		db.Entry.findOne(
			{ _id: req.params.docId, 'tidbits.docId': req.params.bitId },
			{ _id: 0, 'tidbits.$': 1 },
			function(err, result) {
				if (err) return console.error(err);
				if (result.tidbits.length > 0) {
					api.getRevisionHistoryOfTidbit(result.tidbits[0], function(history) {
						res.render('history_tidbit', { history: history });
					});
				} else {
					res.redirect('back');
				}
		});
	};

	return {
		show:			show,

		newEntry:		newEntry,
		createEntry:	createEntry,
		editEntry:		editEntry,
		entryHistory:	entryHistory,

		createTidbit:	createTidbit,
		editTidbit:		editTidbit,
		removeTidbit:	removeTidbit,
		tidbitHistory:	tidbitHistory
	}
};