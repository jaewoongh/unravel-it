module.exports = function(mongoose) {
	var ObjectId = mongoose.Schema.Types.ObjectId;
	var listSchema = new mongoose.Schema({
		recentlyEditedEntries: [{
			title:		String,
			slug:		String,
			lastEdit:	Date,		// Date of the last edit
			status:		String,		// Could be 'published' or else
			docId:		ObjectId	// Id of actual entry (has date data of creation)
		}]
	});
	return {
		schema:	listSchema,
		model:	mongoose.model('List', listSchema)
	}
}