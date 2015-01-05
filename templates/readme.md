#Templates

Templates give create the basic outline or format for the LaTeX document.  These tempaltes can be used standalone - simply by selecting the template when building your board, the result is a PDF - or can be used to create a basic outline that can be later edited to suit your needs.

###How does it work?
1. A user goes to the Trello2LaTeX webpage and selects the template they wish to use
2. Trello2LaTeX parses the template using Mustache and its own TeX parsing library
3. Trello2LaTeX generates both raw LaTeX document and a PDF which a user can then download

##Templating 101
- Each template is placed into a unique folder in the /templates directory - the server will use each folder to generate a list
- Each template folder must contain the following elements:
  - **index.tex**: The main LaTeX template
  - **snapshot.png**: Small (size to be determined) snapshot of the template
  - **template.yml**: Contains keys and values as settable options - these exact options will be give to the user - they will represent values in template parsing below
  - All of its assets accessed by index.tex (e.g. include files, images, etc.) must be placed in this folder as well

For now, this process is manual and requires direct server access.  After a few successful builds, we'll streamline this system so users can upload their own LaTeX templates.

###Basic template
template.yml
``` yaml
title: My Awesome Title
author: Me
```
index.tex
``` tex
\documentclass[12pt]{book} %set the document class - this can be whatever you want
% ... any LaTeX formatting here

\begin{document}

% make a title page
\title{<! title >}
\author{<! author >}
\maketitle

\end{document}
```
The document will turn into and compile as
``` tex
% ...
\title{My Awesome Title}
\author{Me}
\maketitle
% ...
```

### Using the board's data
A hard-set author and title is great and all, but let's use the Trello board to get the title and author.

index.tex
``` tex
% ...
\title{<! b.title >}
\author{<! b.org.name >}
% ...
```
If the user selected to build the Trello development board at https://trello.com/b/nC8QJJoZ/trello-development, the result will be
``` tex
\title{Trello Development}
\author{Trello Inc}
```

### Conditional statements
Sometimes an if or if not statement is handy.
``` tex
<!# b.org.isorg > % '#' implies IF statement
\author{<! b.org.name >}
<!/ b.org.isorg > % '/' is an END of an if statement
<!^ b.org.isorg > % '^' implies IF NOT
\author{Some random user}
<!/ b.org.isorg > % again closes statement
```
For board https://trello.com/b/nC8QJJoZ/trello-development:
``` tex
\author{Trello Inc}
```
For board https://trello.com/b/xUxQcZQA/test-board:
``` tex
\author{Some random user}
```

### Iterating through an object
Say you want to get the name of every list in the board...
``` tex
<!# b.lists > % the '#' directive is used to loop through an object as well... if will only not enter the loop if b.lists is null, undefined, of length zero, or is a boolean set to false
<! name >\\ % this states... for every b.lists, get b.lists.name (we added a newline as well)

<!/ b.lists >
```
Result for board https://trello.com/b/nC8QJJoZ/trello-development:
``` tex
Info\\
Ideas\\
Known Issues\\
In Progress\\
% ...
```
### Including other TeX files
If you really want to, you can include any TeX file using the TeX native syntax: `\include{file}`.  Mustache will parse these the same way as it does any partial: `{{< file }}`

### User-defined variables
Sometimes it's nice to allow the user to choose the text to display.  For example, if you want the user to choose a custom title while selecting the template, you need to add a field to `template.yml`...
``` yaml
mytitle: { display: "Title", type: blank }
```
... and use it directly in the TeX file!
``` tex
\title{<! mytitle >}
```
You can lso use long forms, checkboxes, and selects!  For those, see the user API below.

### Differences from Mustache
- Delimiters changed to <! > to avoid problems with TeX
- Triple mustache {{{ }}} disabled as HTML escaping is useless in TeX
- Partial directives replaced with TeX's native `\include{}`

#Template API

###Board data
The `b` (board) object contains a colelction of data retrieved from the board selected by the user.

b | Example Result
----------|----------
b.title | `My Board`
b.desc | `Board description goes here`
b.url | `https://trello.com/b/nC8QJJoZ/trello-development`
b.lastmodified | `2015-01-01T16:38:29.816Z`

A `b.org` (owner of the board) is identical if a user created the board, or if the board is owned jointly by an organization.  Use `b.org.isorg` to tell whether a user or org owns the board.

b.org | Example Result
----------|----------
b.org.name | `Trello Inc` or `Arthur Pachachura`
b.org.url | `https://trello.com/trelloinc` or `https://trello.com/arthurpachachura1`
b.org.isorg | `true` or `false`

While Trello2LaTeX is gathering data about the board, it temporarily downloads all user avatars into the `img/` folder relative to the template.  If an avatar is not found, `b.members.avatar` will be `null`.  In these cases, use `b.members.initials` to create one.

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

#### Getting lists, cards, checklists, etc.
The `b.lists` namespace stores all list data.  The hierarchy goes like this:

| b.lists |
| ---------- |
| cards |
| members, actions, voters, checklists, attachments |

b.lists | Example Result
----------|----------
b.lists.cards | [ {Card objects - see below } ]
b.lists.name | `To Do`

b.lists.cards | Example Result
----------|----------
card | A card from a list in b.lists
card.name | `Get Trello2LaTeX done`
card.desc | `Description: do stuff...`
card.lastmodified | `2015-01-01T16:38:29.816Z`
card.due | `2015-01-01T00:00:00.000Z` or `null` (if no due date set)
card.url | `https://trello.com/c/xbiE4Eyf/1-test-card`
card.labels | [ { Identical in usage to b.labels object } ]
card.attachments | [ { Attachments object - see below } ]
card.attachmentcover.filename | `dl/asdfadsfasfddsfafdadfsadfs.jpg` (location on disk of cover)
card.members | [ { Members object - identical in usage to b.members } ]
card.votecount | `1` (length of voters object)
card.voters | [ { Voters object - identical to members object } ]
card.checklists | [ { Checklists object - see below } ]
card.actions | [ { Actions object - see below } ]

Trello2LaTeX also downloads all attachment images to the `dl/` folder.  It will not download non-image files (eps, png, jpg, or jpeg), but WILL create an attachment object for it with `attach.isimage` set to `false`.

b.lists.cards.attachments | Example Result
----------|----------
attach | A file attachment
attach.filename | `dl/deadbeefdeadbeef1234134.png` (A location on disk)
attach.name | `deadbeefdeadbeef1234134` (Just the name)
attach.ext | `.png` (file extension)
attach.date | `2015-01-01T16:38:29.816Z` (date image was taken)
attach.isimage | `true` (if png, jpg, jpeg, or eps), else `false`

b.lists.cards.checklists | Example Result
----------|----------
check | A checklist
check.name | `My Checklist`
check.items | { [ Checklist item array - see below } ]

b.lists.cards.checklists.items | Example Result
----------|----------
item | A checklist item
item.name | `My Checklist Item`
item.checked | `true` or `false`

#User API
User-defined variables allows the user to set the values for use in the TeX file.  These variables are read in JSON format from `template.yml`, given to the user, and the result is then passed to the TeX file.

### Basic input
To create a basic user text box, set the YML as such, with certain accepted overloads.
``` yaml
variable: { display: "My Variable Name", type: "blank" }
```
Then in the TeX file
``` tex
\title{<! variable >)
```

If the user types `SOMETHING` into the text box, the result will be
``` tex
\title{SOMETHING}
```

### Null input
What happens if the input is null?  In the example above, `<! variable >` will not be rendered because the user entered a string with length of zero, resulting in
``` tex
\title{}
```
Which doesn't go over very well with LaTeX.

So we can set a special field in the YAML:
``` yaml
variable: { display: "My Variable Name". type: "blank", noblank: true }
```
Denying a blank field, not allowing the user to build the template if the text box is null.


### Setting a default value
If you want to give the user a default value if nothing is entered, set `default` in the YAML:
``` yaml
variable: { display: "My Variable Name", type: "blank", default: "NOTHING ENTERED" }
```
If the user enters nothing, the default value would be placed instead of `<! variable >`.

### Making a checkbox
To make a user-friendly checkbox, try this:
``` yaml
mycheckbox: { display: "My Checkbox", type: "check", default: true }
```
The checkbox will render and the result will either be "true" or "false".  If you want to change the results, set `options`:
``` yaml
mycheckbox: { display: "My Checkbox", type: "check", default: true, options: { true: "That's right!". false: "Nope!  It's false!" } }
```
If the result is true, the TeX fil will be rendered as `That's right!`, otherwise `Nope! It's false!`.

### Making a dropbown (select)
A selection box can be set as such:
``` yaml
mydropdown: { display: "My Dropdown", type: "select", default: "one", options: { "one": "First", "two": "Second", "three": "Third" } }
```
The options displayed to the user are `one`, `two`, and `three`, and the result is typeset as `First`, `Second`, `Third`.

### Making a paragraph form
Instead of a single-line text box, a paragraph input box may be created by setting `type` to `"form"`.

## User API Overview

YAML Field | What it does
----------|----------
`[variable]:` | The variable name, as typeset in the TeX file
`display: "[displayname]"` | String, the text displayed to the user explaining the field
`type: "[type]"` | String, one of `"blank"`, `"select"`, `check`. or `form`
`default: [defaultkey]` | The default key, for example `true` in a checkbox
`options: { [key]:[value], ...}` | Only for checkboxes and selects, assings something displayed to a LaTeX output
