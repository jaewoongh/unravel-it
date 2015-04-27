module.exports = function(mongoose, db) {
	// Cover page
	var coverpage = function(req, res) {
		res.render('cover');
	};

	return {
		coverpage:	coverpage
	}
};