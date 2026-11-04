const destination = new URL("problem_submit.html", window.location.href);
destination.search = window.location.search;
destination.hash = window.location.hash;
window.location.replace(destination);
