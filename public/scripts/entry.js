(function(scope) {
	function Entry(element, column) {
		this.initialize(element, column);
	}
	var p = Entry.prototype;

	// Constructor
	p.initialize = function(element, column) {
		this.element = element;
		this.column = column;
		this.header = this.element.getElementsByTagName('header')[0];
		this.summary = this.element.getElementsByTagName('summary')[0].innerHTML.trim().replace(/\<br\>/g, '\n').replace(/<a.+href="\/tl\/(\S+)">(.+)<\/a>/igm, '[$2]($1)').replace(/\<br\>/g, '\n').replace(/<a.+href="(\S+)">(.+)<\/a>/igm, '[$2]($1)');
		this.title = element.dataset.title;
		this.id = element.dataset.id;
		this.slug = element.dataset.slug;
		this.tidbits = [];
		this.x = 0;
		this.y = 0;
		this.shiftLeft = this.element.getElementsByClassName('entry-icon shift-left')[0];
		this.shiftRight = this.element.getElementsByClassName('entry-icon shift-right')[0];
		this.history = this.element.getElementsByClassName('entry-icon history')[0];
		this.edit = this.element.getElementsByClassName('entry-icon edit')[0];
		this.addNew = this.element.getElementsByClassName('entry-icon addnew')[0];
		this.close = this.element.getElementsByClassName('entry-icon close')[0];
	};

	// Add new child tidbit
	p.addTidbit = function(tidbit) {
		this.tidbits.push(tidbit);
	};

	// Move to the right position
	p.place = function() {
		this.element.style.webkitTransform = 'translate3d(' + this.x + 'px,' + this.y + 'px,0)';
		this.element.style.transform = 'translate3d(' + this.x + 'px,' + this.y + 'px,0)';
	};

	// Place sticky title
	p.placeSticky = function(zoom) {
		zoom = zoom || 1.0;
		var scrollY = window.scrollY / zoom;
		this.sticky.style.webkitTransform = 'translate3d(' + this.x + 'px,' + (this.y + scrollY) + 'px,0)';
		this.sticky.style.transform = 'translate3d(' + this.x + 'px,' + (this.y + scrollY) + 'px,0)';
	};

	scope.Entry = Entry;
}(window));