# Templates

Templates give create the basic outline or format for the LaTeX document.  These templates can be used standalone - simply by selecting the template when building your board, the result is a PDF - or can be used to create a basic outline that can be later edited to suit your needs.

### How does it work?
1. A user goes to the Notebook Genie webpage and selects the template they wish to use
2. Notebook Genie parses the template using Mustache and its own TeX parsing library
3. Notebook Genie generates both raw LaTeX document and a PDF which a user can then download

## Templating 101
- Each template is placed into a unique folder in the /templates directory - the server will use each folder to generate a list
- Each template folder must contain the following elements:
  - **install.sh**: An install and build script. Built contents should go into the `dist/` folder once processed.
  - ***dist/***: The entire built template. Templates are built on server startup and their complete builds are placed into this folder.
  - **src/template.html** -> ***dist/template.html***: HTML template, processed using this API when built in Notebook Genie.
  - **template.yml**: Contains keys and values as settable options - these exact options will be give to the user - they will represent values in template parsing below

# Template API

## Board data
The `b` (board) object contains a collection of data retrieved from the board selected by the user.

b | Example Result
----------|----------
b.title | `My Board`
b.desc | `Board description goes here` - returns plaintext - no HTML content.
b.url | `https://trello.com/b/nC8QJJoZ/trello-development`
b.lastmodified | `01/01/2001 14:00` or similar date format (date of last change on Trello)
b.timebuilt **(New)** | `01/01/2001 14:00` or similar date format (date of Notebook Genie build)

A `b.org` (owner of the board) is identical if a user created the board, or if the board is owned jointly by an organization.  Use `b.org.isorg` to tell whether a user or org owns the board.

b.org | Example Result
----------|----------
b.org.name | `Trello Inc` or `Arthur Pachachura`
b.org.url | `https://trello.com/trelloinc` or `https://trello.com/arthurpachachura1`
b.org.isorg | `true` or `false`

While Notebook Genie is gathering data about the board, it temporarily downloads all user avatars into the `img/` folder relative to the template.  If an avatar is not found, `b.members.avatar` will be `null`.  In these cases, use `b.members.initials` to create one.

b.members | Example Result
----------|----------
b.members.name | `Some guy`
b.members.initials | `SG`
b.members.avatar | `img/538f9c01c2a21f2bbf81a610.png` (filename where the avatar is downloaded) or `null`
b.members.username | `someguy`
b.members.url | `https://trello.com/someguy`

`b.labels` stores details about the labels of a board.  An example query of `b.labels` is `{ green: 'low', yellow: 'important', red: 'critical' }`.

b.labels | Example Result
----------|----------
b.labels.[label] | value of label
b.labels.red (example) | `critical`
b.labels.purple (example) | `undefined` (will not render)

### Getting lists, cards, checklists, etc.
The `b.lists` namespace stores all list data.  The hierarchy goes like this:

| b.lists |
| ---------- |
| cards |
| members, actions, voters, checklists, attachments |

b.lists *[array]* | Example Result
----------|----------
cards | [ {Card objects - see below } ]
name | `To Do`
id **(New)** | `b67b9c07d08d087dda0099` (a unique identifier)

b.lists.cards *[array]* | Example Result
----------|----------
name | `Get Notebook Genie done`
desc **(Updated)** | `<p>Description: do stuff...</p>` - returns HTML content
id **(New)** | `b67b9c07d08d087dda0099` (a unique identifier)
list **(New)** | A partial instance of the list containing this card. The list will only have its `name` and `id`.
lastmodified | `01/01/2001 14:00` or similar date format
due | `01/01/2001 14:00` or `null` (if no due date set)
url | `https://trello.com/c/xbiE4Eyf/1-test-card`
labels | [ { Identical in usage to b.labels object } ]
attachments | [ { Attachments object - see below } ]
attachmentcover | { Attachments object - see below }
members | [ { Members object - identical in usage to `b.members` } ]
votecount | `1` (length of voters object)
voters | [ { Voters object - identical to members object } ]
checklists | [ { Checklists object - see below } ]
actions *(Not yet implemented)* | [ { Actions object - see below } ]
exists **(New)** | [ { Checks whether certain items exist - see below }]

Notebook Genie also downloads all attachment images to the `dl/` folder.  It will not download non-image files (eps, png, jpg, or jpeg), but WILL create an attachment object for it with `attach.isimage` set to `false`.

b.lists.cards.attachments *[array]* | Example Result
----------|----------
attach | A file attachment
attach.filename | `dl/deadbeefdeadbeef1234134.png` (A location on disk)
attach.name | `deadbeefdeadbeef1234134` (Just the name)
attach.ext | `.png` (file extension)
attach.date | `01/01/2001 14:00` or similar date format (date image was taken)
attach.isimage **(Updated)** | `true` (if one of the following renderable image formats: `.jpg`/`.jpeg`, `.png`, `.tiff`, `.gif`, or `.svg`), else `false`

b.lists.cards.comments *[array]* **(Updated)** | Example Result
----------|----------
content **(Updated)** | `<p>Hi there, this is a comment.</p>`, returns HTML content
date | `01/01/2001 14:00` or similar date format
author | An instance of `b.members`
iscomment | `True` if a comment
isattachment | `True` if an attachment

b.lists.cards.checklists *[array]* | Example Result
----------|----------
check.name | `My Checklist`
check.items | { [ Checklist item array - see below } ]

b.lists.cards.checklists.items *[array]* | Example Result
----------|----------
name | `My Checklist Item`
checked | `true` or `false`

b.lists.cards.exists **(New)** | Example Result
----------|----------
checklists | `True` if the card contains at least one checklist, `False` otherwise
comments | `True` if the card contains at least one comment, `False` otherwise

### Front Matter API **(Updated)**

If a list called `NotebookGenie Front Matter` (verbatim) exists in the board, the list will be rendered in a special way:

- It will be the first part after the table of contents
- Each card will be on a new page, but have no list attached to it (every card is the largest heading in the table of contents)
- Comments and checklists will be ignored
- The content inside the description can be HTML if the card title begins with `&` - otherwise, it will be rendered normally as Markdown converted to HTML

Try creating this list on your board to try it out! All features of standard markdown are supported. This feature is only available when the entire board is built.

b.frontmatter *[Array]* **(New)** | Example Result
----------|----------
name | Name of the page (name of the card)
content | HTML content of the card

### Ignoring cards or lists

If the first character in a card or list is `!`, then the card or list will be ignored and not rendered.
