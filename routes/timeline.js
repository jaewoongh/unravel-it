module.exports = function(mongoose, db, slug) {
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
				data.push(entry);

				// Recursively get data
				if (++n < entries.length) {
					load(entries, n);
				} else {
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
		} else if (!Boolean(req.body.summary.trim())) {
			res.render('newentry', { error: "Please summarize what it is about." })
		} else {
			console.log('New entry creation requested.');
			var entryId = new mongoose.Types.ObjectId;
			var summaryId = new mongoose.Types.ObjectId;
			var timestamp = summaryId.getTimestamp();

			var fakeUser = new mongoose.Types.ObjectId;
			var fakeIp = '127.0.0.1';

			// Create summary Tidbit
			var summary = new db.Tidbit({
				docId:			summaryId,
				v:				0,
				momId:			entryId,
				type:			'entry-summary',
				editorId:		fakeUser,
				editorIp:		fakeIp,
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
				editorId:		fakeUser,
				editorIp:		fakeIp,
				note:			'First creation',
				title:			req.body.title.trim(),
				status:			'published'
			});

			// Create new Entry with summary and marker tidbit
			var newEntry = new db.Entry({
				_id:			entryId,
				title:			req.body.title.trim(),
				slug:			slug(req.body.title.trim()).toLowerCase(),
				creatorId:		fakeUser,
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

						// Update the List
						db.List.findOneAndUpdate({}, {
							$push: {'entries': {
									title:		entry.title,
									slug:		entry.slug,
									docId:		entry._id,
									lastEdit:	new Date()
								}
							}
						},
						{ upsert: true },
						function(err) {
							if (err) return console.error(err);
							console.log('New entry has been added to the List: ' + entry._id);
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
		// Get current version of entry
		db.Entry.findOne(
			{ _id: req.params.docId },
			{ 'summary': 1 },
			function(err, result) {
				if (err) return console.error(err);
				if (result.summary.length > 0) {
					console.log('Entry editing requested: ', result._id);
					var summary = result.summary[0].toObject();
					delete summary._id;

					// New summary
					var fakeUser = new mongoose.Types.ObjectId;
					var fakeIp = '127.0.0.1';
					var newSummary = new db.Tidbit({
						docId:			summary.docId,
						v:				summary.v + 1,
						momId:			req.params.docId,
						type:			'entry-summary',
						editorId:		fakeUser,
						editorIp:		fakeIp,
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
						db.Entry.update(
							{ _id: req.params.docId },
							{ $set: { 'summary': [newSummary] } },
							function(err, summary) {
								if (err) return console.error(err);
								console.log('Entry successfully updated:', result._id);

								// Update the List
								db.List.update({ 'entries.docId': req.params.docId }, {'$set': {
									'entries.$.lastEdit': new Date()
								}}, function(err) {
									if (err) return console.error(err);
									console.log('List successfully updated for the entry: ', req.params.docId);
									res.redirect('back');
								});
							}
						);
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
			var currentSummary = result.summary[0];
			db.History.find(
				{ momId: result._id, $or: [{type: 'entry-creation'}, {type: 'entry-summary'}, {type: 'entry-removal'}] },
				null,
				{ sort: { timeOfCreation: -1 } },
				function(err, histories) {
					if (err) return console.error(err);
					histories.unshift(currentSummary);
					// res.json(histories);
					res.render('history_entry', { history: histories });
				}
			);
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
		console.log('New tidbit requested.');
		var fakeUser = new mongoose.Types.ObjectId;
		var fakeIp = '127.0.0.1';

		var newTidbit = new db.Tidbit({
			docId:			new mongoose.Types.ObjectId,
			v:				0,
			momId:			req.params.docId,
			type:			'tidbit',
			editorId:		fakeUser,
			editorIp:		fakeIp,
			note:			'First creation',
			title:			req.body.title.trim(),
			description:	req.body.description.trim(),
			media:			req.body.media,
			mediaType:		req.body.mediaType,
			source:			req.body.source,
			timestamp:		createTimestamp(req).timestamp,
			validTime:		createTimestamp(req).validTime,
			status:			'published'
		});

		db.Entry.update(
			{ _id: req.params.docId },
			{ $push: { tidbits: newTidbit } },
			function(err) {
				if (err) return console.error(err);
				console.log('Tidbit successfully added to ' + req.params.docId);

				// Update the List
				db.List.update({ 'entries.docId': req.params.docId }, {'$set': {
					'entries.$.lastEdit': new Date()
				}}, function(err) {
					if (err) return console.error(err);
					console.log('List successfully updated for the entry: ', req.params.docId);
					res.redirect('back');
				});
		});
	};

	// Edit tidbit
	var editTidbit = function(req, res) {
		// Get current version of tidbit
		db.Entry.findOne(
			{ _id: req.params.docId, 'tidbits.docId': req.params.bitId },
			{ _id: 0, 'tidbits.$': 1 },
			function(err, result) {
				if (err) return console.error(err);
				if (result.tidbits.length > 0) {
					console.log('Tidbit editing requested: ', result.tidbits[0]._id);
					var tidbit = result.tidbits[0].toObject();
					delete tidbit._id;

					// New tidbit
					var fakeUser = new mongoose.Types.ObjectId;
					var fakeIp = '127.0.0.1';
					var newTidbit = new db.Tidbit({
						docId:			tidbit.docId,
						v:				tidbit.v + 1,
						momId:			req.params.docId,
						type:			'tidbit',
						editorId:		fakeUser,
						editorIp:		fakeIp,
						note:			req.body.note.trim(),
						title:			req.body.title.trim(),
						description:	req.body.description.trim(),
						// media:			req.body.media,
						// mediaType:		req.body.mediaType,
						source:			req.body.source,
						timestamp:		createTimestamp(req).timestamp,
						validTime:		createTimestamp(req).validTime,
						status:			tidbit.status
					});

					// Check if anything is updated
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
					if (!isUpdated(tidbit, newTidbit)) {
						console.log('Nothing really has been changed.');
						return res.redirect('back');
					}

					// Copy current version of tidbit into history collection
					var history = new db.History(tidbit);
					history.timeOfCreation = new Date(result.tidbits[0]._id.getTimestamp());
					history.save(function(err, history) {
						if (err) return console.error(err);
						console.log('Existing tidbit has successfully been copied to history: ', history._id);

						// Replace current version of tidbit
						db.Entry.update(
							{ _id: req.params.docId, 'tidbits.docId': req.params.bitId },
							{ $set: { 'tidbits.$': newTidbit } },
							function(err) {
								if (err) return console.error(err);
								console.log('Tidbit successfully replaced with new one: ', newTidbit._id);

								// Update the List
								db.List.update({ 'entries.docId': tidbit.momId }, {'$set': {
									'entries.$.lastEdit': new Date()
								}}, function(err) {
									if (err) return console.error(err);
									console.log('List successfully updated for the entry: ', tidbit.momId);
									res.redirect('back');
								});
							}
						);
					});
				} else {
					res.redirect('back');
				}
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
					var currentVersion = result.tidbits[0];
					db.History.find(
						{ docId: currentVersion.docId },
						null,
						{ sort: { v: -1 } },
						function(err, histories) {
							if (err) return console.error(err);
							// res.json({ history: histories });
							histories.unshift(currentVersion);
							res.render('history_tidbit', { history: histories });
						}
					);
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
		tidbitHistory:	tidbitHistory
	}
};