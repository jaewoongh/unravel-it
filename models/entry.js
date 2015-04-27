module.exports = function(mongoose, Tidbit) {
	var ObjectId = mongoose.Schema.ObjectId;
	var entrySchema = new mongoose.Schema({
		// _id (auto)				// Unique ID and timestamp of creation

		title: {
			type:		String,		// Title of the entry
			unique:		true		// Should be unique
		},

		slug: {
			type:		String,		// URI encoded title
			unique:		true		// Should be unique because it'll be used as a permalink
		},

		creatorId:		ObjectId,	// User ID(_id) who created the entry

		summary:		[Tidbit],	// A summary about the entry as a whole
		tidbits:		[Tidbit],	// Tidbits of timeline data

		lastmodified:	Date,		// Time last modified

		status:			String		// Can be either: published, removed
	});
	return {
		schema:	entrySchema,
		model:	mongoose.model('Entry', entrySchema)
	}
};