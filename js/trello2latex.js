exports.build = function build(data) {
	//complete credential verification
	//download JSON -> raw
	//create JSON array to store board information for LaTeX -> b
	//create user preferences array -> u

	//***** Create LaTeX-Usable JSON Cache *****//
	//create image for each member -> b.members.image
	//get name for each member -> b.members.name
	//remaining data raw.members -> b.members
	//raw,shortLink -> b.id
	//raw.url -> b.url
	//raw.labelNames -> b.labels
	//raw.dateLastActivity -> b.lastmodified
	//raw.dateLastView -> b.lastviewed
	//raw.lists -> b.lists
	//raw.cards -> b.cards and send id to b.lists.cards
	//raw.checklists -> b.checklists and send id to b.lists.cards.checklists

};
