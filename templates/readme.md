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
  - **template.yml**: Contains keys and values as settable options - these exact options will be give to the user - they will represent values in template parsing below
  - All of its assets accessed by index.tex (e.g. include files, images, etc.) must be placed in this folder as well

For now, this process is manual and requires direct server access.  After a few successful builds, we'll streamline this system so users can upload their own LaTeX templates.

###Template Parsing
Keyphrase | Example Result
----------|----------
<! KEY_IN_TEMPLATE.YML !> | A key, such as "test: { nothing: 0, something: 1 }", when used in the LaTeX document as <! test !> will return 0 if the user selected "nothing" and 1 if the user selected "something"
<! org !> | Arthur Pachachura
<! user !> | Arthur Pachachura (identical to org)
<! board !> | Chores List

Note that all Mustache processing works with templates!  (The only difference to remember is to use the <! !> set delimiters instead of {{{ }}}