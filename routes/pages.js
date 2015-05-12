module.exports = function(mongoose, db) {
	// Cover page
	var coverpage = function(req, res) {
		res.render('cover');
	};

	// About page
	var aboutpage = function(req, res) {
		res.render('about');
	};

	return {
		coverpage:	coverpage,
		aboutpage:	aboutpage
	}
};