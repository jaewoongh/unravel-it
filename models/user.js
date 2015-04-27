module.exports = function(mongoose) {
	var ObjectId = mongoose.Schema.ObjectId;
	var userSchema = new mongoose.Schema({
		// _id (auto)				// Unique ID and timestamp of creation

		email: {
			type:		String,
			required:	true,
			unique:		true
		},

		username: {
			type:		String,
			required:	true,
			unique:		true
		},

		password: {
			type:		String,
			required:	true,
		},

		photo:			String,		// Link to profile photo
		about:			String,		// Some words about the user by himself
		activity:		[ObjectId],	// User's activity history

		status:			String		// Can be either: active, blocked, withdrawn
	});
	return {
		schema:	userSchema,
		model:	mongoose.model('User', userSchema)
	}
};