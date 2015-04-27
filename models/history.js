module.exports = function(mongoose) {
	var ObjectId = mongoose.Schema.Types.ObjectId;
	var historySchema = new mongoose.Schema({
		// _id (auto)				// Unique ID and timestamp of creation
		timeOfCreation:	Date,		// Remember time when it became tidbit, not a history
		docId:			ObjectId,	// ID/timestamp shared with current version and all history of this tidbit
		v:				Number,		// Revision number (increment from 0)
		momId:			ObjectId,	// Mother Entry's unique ID
		type:			String,		// Either: tidbit,
									//         entry-creation (for creating the entry),
									//         entry-summary  (for changing entry summary),
									//         entry-removal  (for removing the entry),
									//         user-creation  (for creating the user),
									//         user-photo     (for chaning user photo),
									//         user-about     (for chaning user's about text)

		editorId:		ObjectId,	// User who made contribution
		editorIp:		String,		// IP adress of the editor
		note:			String,		// Note about the change made

		title:			String,		// One line title
		description:	String,		// Brief description
		media:			String,		// Image or movie path
		mediaType:		String,		// Whether it is an image or a movie
		source:			String,		// Credible source link for the information

		timestamp:		Date,		// Time info for the information
		validTime:		Number,		// To down what degree the timestamp is valid
									// 1: Year
									// 2: Year and month
									// 3: Year, month and day
									// 4: Year, month, day and hour
									// 5: Year, month, day, hour and minute
									// 6: Year, month, day, hour, minute and second
									// 7: Year, month, day, hour, minute, second, and milisecond

		status:			String		// Can be either: published, removed
	});
	return {
		schema:	historySchema,
		model:	mongoose.model('History', historySchema)
	}
};