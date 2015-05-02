(function(scope) {
	function Tidbit(element, mom) {
		this.initialize(element, mom);
	}
	var p = Tidbit.prototype;

	// Constructor
	p.initialize = function(element, mom) {
		this.element = element;
		this.mom = mom;
		this.titleElement = element.getElementsByTagName('h3')[0];
		this.title = element.dataset.title;
		this.id = element.dataset.id;
		this.timestamp = new Date(element.dataset.time);
		this.validTime = parseInt(element.dataset.validtime);
		this.millisecond = parseInt(element.dataset.millisecond.substring(1));
		if (this.millisecond) this.timestamp.setMilliseconds(this.millisecond);
		this.source = element.dataset.source;
		this.x = 0;
		this.y = 0;
		this.content = element.getElementsByClassName('content')[0];
		this.detail = element.getElementsByClassName('details')[0];
		this.description = element.getElementsByClassName('description')[0].innerHTML.trim().replace(/\<br\>/g, '\n').replace(/<a.+href="\/tl\/(\S+)">(.+)<\/a>/igm, '[$2]($1)').replace(/\<br\>/g, '\n').replace(/<a.+href="(\S+)">(.+)<\/a>/igm, '[$2]($1)');
		this.folded = false;
		this.history = element.getElementsByClassName('tidbit-icon history')[0];
		this.edit = element.getElementsByClassName('tidbit-icon edit')[0];
	};

	// Move to the right position
	p.place = function() {
		this.element.style.webkitTransform = 'translate3d(' + this.x + 'px,' + this.y + 'px,0)';
		this.element.style.transform = 'translate3d(' + this.x + 'px,' + this.y + 'px,0)';
	};

	p.expand = function() {
		window.setTimeout(function() { this.detail.style.opacity = 1; }.bind(this), 10);
		this.detail.style.display = 'block';
		this.folded = false;
	};

	p.fold = function() {
		this.detail.style.opacity = 0;
		window.setTimeout(function() { this.detail.style.display = 'none'; }.bind(this), 110);
		this.folded = true;
	};

	p.isFolded = function() {
		return this.folded;
	};

	p.isExpanded = function() {
		return !this.folded;
	};

	scope.Tidbit = Tidbit;
}(window));