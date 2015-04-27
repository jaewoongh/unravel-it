var help = {
	// Remap a value into a new range
	map: function(val, fromMin, fromMax, toMin, toMax) {
		if (fromMin == fromMax) return toMin;
		return (val - fromMin) * (toMax - toMin) / (fromMax - fromMin) + toMin;
	},

	// Get px with em in a certain context
	em2px: function(em, context) {
		return em * parseFloat(getComputedStyle(context || document.documentElement).fontSize);
	}
};