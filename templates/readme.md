#Templates

Templates give create the basic outline or format for the LaTeX document.  These tempaltes can be used standalone - simply by selecting the template when building your board, the result is a PDF - or can be used to create a basic outline that can be later edited to suit your needs.

###How does it work?
1. A user goes to the Trello2LaTeX webpage and selects the template they wish to use
2. Trello2LaTeX parses the template using Mustache and its own TeX parsing library
3. Trello2LaTeX generates both raw LaTeX document and a PDF which a user can then download

###Templating 101
- Each template is placed into a unique folder in the /templates directory - the server will use each folder to generate a list
- Each template folder must contain the following elements:
  - **index.tex**: The main LaTeX template
  - **snapshot.png**: Small (size to be determined) snapshot of the template
  - All of its assets accessed by index.tex (e.g. include files, images, etc.) must be placed in this folder as well

For now, this process is manual and requires direct server access.  After a few successful builds, we'll streamline this system so users can upload their own LaTeX templates.

###Template Parsing
Keyphrase | Example Result
----------|----------
**{{{ org }}}** | Arthur Pachachura
**{{{ user }}}** | Arthur Pachachura (identical to org)
**{{{ board }}}** | Chores List
