//= require jquery.ba-bbq
//= require jquery.url

/* 
 * AJAX Pagination: Ajaxifying your pagination links
 * https://github.com/ronalchn/ajax_pagination
 * 
 * Copyright (c) 2012 Ronald Ping Man Chan
 * Distributed under the LGPL license
 *
 * Although the ajax_pagination gem as a whole is distributed under LGPL, I am expressly permitting users to minify and concatenate this javascript file
 * with other javascript files, as long as it is through an automatic asset management process (eg. Sprockets), and the automatic asset
 * management process obtains this javascript file as a separate file via dynamically linked means (ie. with this file left in the separately
 * installed ajax_pagination gem).
 *    ~ Ronald Chan
 */
jQuery(document).ready(function () {
  function minVersion(version) {
    var $vrs = window.jQuery.fn.jquery.split('.'),
        min  = version.split('.');
    for (var i=0, len=min.length; i<len; i++) {
      if ($vrs[i]) {
        min[i] = parseInt(min[i],10);
        $vrs[i] = parseInt($vrs[i],10);
        if ($vrs[i] < min[i]) return false;
        else if ($vrs[i] > min[i]) return true;
      }
      else return false;
    }
    return true;
  }
  
  
    if (!(History && minVersion('1.7'))) { // dependencies missing
      var missing = "";
      if (!History) missing += "\nHistory.js not installed";
      if (!minVersion('1.7')) missing += "\njQuery version 1.7+ not installed. Currently installed: jQuery " + window.jQuery.fn.jquery;
      alert("AJAX Pagination MISSING_DEPENDENCIES:" + missing);
    }
  
  (function( $ ) { // on document ready
    if (History && History.enabled && minVersion('1.7')) {
      ///////////////////////////////////
      ////// $.ajax_pagination API //////
      ///////////////////////////////////
      // selector function for pagination object
      $.ajax_pagination = function (pagination_name) {
        return new pagination_object(pagination_name);
      };
      $.ajax_pagination.version = '0.5.1.alpha';
      $.ajax_pagination.enabled = true;
      function pagination_object(pagination_name) {
        this.get = function(url,options) {
          if (options === undefined) options = {};
          if (options.history === undefined) options.history = true;
          swapPage(pagination_name,url,options.history);
        }
        this.exists = function() {
          return $('#' + pagination_name + '_paginated_section').length == 1;
        }
      }
      /////////////////////////////
      ////// Basic Internals //////
      /////////////////////////////
      var pagination_loader_state = new Array(); // the page we are waiting for
      var pagination_url = location.href; // url we came from, so we can see transitions of the url
      var history_state = {ajax_pagination_set:true}; // current history state

      function display_pagination_loader(pagination_name) {
        var paginated_section = getSection(pagination_name);
        if (pagination_loader_state[pagination_name] === undefined) { // show loader if not already shown
          if ($.rails.fire(getSection(pagination_name),"ajaxp:loading")) {
            var paginated_content;
            if (paginated_section.hasClass("paginated_content")) paginated_content = paginated_section; // if the whole section is a loading zone
            else paginated_content = paginated_section.children(".paginated_content").first(); // don't want to support multiple loader images
            var height = paginated_content.height();
            // setup loading look
            var img = document.createElement("IMG");
            if (paginated_section.data("pagination") !== undefined && paginated_section.data("pagination").image !== undefined) img.src = paginated_section.data("pagination").image;
            else img.src = "/images/ajax-loader.gif";
            var margin = Math.round(height>400?50:(height/8));
            $(img).addClass('ajaxpagination-loader');
            var div = document.createElement("DIV");
            $(div).addClass('ajaxpagination-loadzone');
            $(div).append("<div class=\"margin-top\" />").append(img);
            paginated_content.wrapInner("<div class=\"ajaxpagination-oldcontent\" />");
            paginated_content.append(div);
          }
        }
        if ($.rails.fire(getSection(pagination_name),"ajaxp:focus")) {
          // scroll to top of paginated_section if it is not visible
          if ($(document).scrollTop() > paginated_section.offset().top - 20) {
            $(document).scrollTop(paginated_section.offset().top - 20);
          }
        }
      }
      function getSection(pagination_name) {
        var id = "#" + pagination_name + "_paginated_section"; // element id we are looking for
        return $(id);
      }
      function getSectionName(section) {
          var id = section.attr("id");
          if (id === undefined) return undefined; // no name
          var pagination_name = /^(.*)_paginated_section$/.exec(id)[1];
          if (pagination_name == null || pagination_name === undefined) return undefined; // pagination not set up properly
          return pagination_name;
      }
      function getSectionNames(sections) {
        var names = new Array();
        sections.each(function () {
          names.push(getSectionName($(this)));
        });
        return names;
      }
      function intersects(a,b) { // do the arrays a and b intersect?
        var i=0, j=0;
        while (i < a.length && j < b.length) {
          if (a[i]<b[j]) i++;
          else if (a[i]>b[j]) j++;
          else return true; // intersects
        }
        return false; // doesn't intersect
      }
      // whether change of state is a reload
      function isReload(pagination_name,from,to) {
        if (from == to) return true; // same url - always a reload
        var section = getSection(pagination_name);
        if (section.length == 0) return false;

        // if data-pagination is not defined, then no reload can be detected
        if (section.data('pagination') === undefined || section.data('pagination').reload === undefined) return false;

        var reload = section.data('pagination').reload;
        if (!(reload instanceof Array)) reload = new Array(reload);
        for (i=0;i<reload.length;i++) {
          if (reload[i].query !== undefined) {
            if ($.deparam.querystring(from)[reload[i].query] !== $.deparam.querystring(to)[reload[i].query]) return false;
          }
          if (reload[i].urlregex !== undefined) {
            var fstr = from, tstr = to;
            if (reload[i].urlpart !== undefined) {
              fstr = $.url(from,true).attr(reload[i].urlpart);
              tstr = $.url(to,true).attr(reload[i].urlpart);
              if (typeof(fstr)!="string" || typeof(tstr)!="string") continue; // skip
            }
            var index = 0;
            if (reload[i].regexindex !== undefined) index = reload[i].regexindex;
            var regex = new RegExp(reload[i].urlregex);
            var frommatch = regex.exec(fstr), tomatch = regex.exec(tstr);
            if (frommatch != null && frommatch.length>=index) frommatch = frommatch[index];
            if (tomatch != null && tomatch.length>=index) tomatch = tomatch[index];
            if (frommatch !== tomatch) return false;
          }
        }
        return true;
      }
      // when this function is used beforeSend of an AJAX request, will use the resulting content in a section of the page
      // this event handler has the same arguments as for jquery and jquery-ujs, except it also takes the name of the section to put the content into as first argument
      // adapter functions will be used to reconcile the differences in arguments, this is required because jquery and jquery-ujs has different ways to get the pagination_name argument
      function beforeSendHandler(pagination_name,jqXHR,settings) {
        var id = "#" + pagination_name + "_paginated_section"; // element id we are looking for
        var requesturl = settings.url;
        var countid = $('[id="' + pagination_name + '_paginated_section"]').length;
        if (countid != 1) { // something wrong, cannot find unique section to load page into
          
            alert("AJAX Pagination UNIQUE_SECTION_NOT_FOUND:\nExpected one pagination section called " + pagination_name + ", found " + countid);
          
          return false; // continue AJAX normally
        }
        if (!$.rails.fire(getSection(pagination_name),"ajaxp:beforeSend",[jqXHR,settings])) return false;
        display_pagination_loader(pagination_name);
        // register callbacks for other events
        jqXHR.done(function(data, textStatus, jqXHR) {
          if (requesturl != pagination_loader_state[pagination_name]) return; // ignore stale content
          if (jqXHR.status == 200 && jqXHR.getResponseHeader('Location') !== null) { // special AJAX redirect
            var redirecturl = jqXHR.getResponseHeader('Location');
            swapPage(pagination_name,redirecturl);
            pagination_url = redirecturl;
            History.replaceState(history_state,document.title,redirecturl); // state not changed
            return;
          }
          // find matching element id in data, after removing script tags
          var page = $("<div />");
          page[0].innerHTML = data; // put response in DOM without executing scripts

          // if page contains a title, use it
          var title = page.find("title");
          if (title.length>0) History.replaceState(history_state,title.html(),location.href);

          // get page contents
          var content = page.find(id);
          if (content.length>0) {
            content = content.html();
            
              alert("AJAX Pagination EXTRA_CONTENT_DISCARDED:\nExtra content returned by AJAX request ignored. Only a portion of the page content returned by the server was required. To fix this, explicitly call ajax_respond :pagination => \"" + pagination_name + "\" to render only the partial view required. This warning can be turned off in the ajax_pagination initializer file.");
            
          }
          else { // otherwise use all the content, including any scripts - we consider scripts specifically returned in the partial probably should be re-run
            content = page.find("body"); // does not tend to work since browsers strip out the html, head, body tags
            if (content.length>0) content = content.html(); // if it has a body tag, only include its contents (for full html structure), leaving out <head> etc sections.
            else content = page.html(); // otherwise include the whole html snippet
          }

          if ($.rails.fire(getSection(pagination_name),"ajaxp:done",[content])) $(id).html(content);

          delete pagination_loader_state[pagination_name]; // not waiting for page anymore

          $.rails.fire(getSection(pagination_name),"ajaxp:loaded");
        });
        jqXHR.fail(function(jqXHR, textStatus, errorThrown) {
          if (requesturl != pagination_loader_state[pagination_name]) return; // ignore stale content
          if ($.rails.fire(getSection(pagination_name),"ajaxp:fail",[jqXHR.responseText])) $(id).html(jqXHR.responseText);

          delete pagination_loader_state[pagination_name]; // not waiting for page anymore

          $.rails.fire(getSection(pagination_name),"ajaxp:loaded");
        });
        return true;
      }
      function swapPage(pagination_name, requesturl, history) { // swaps the page at pagination_name to that from requesturl (used by History.popState, therefore no remote link has been clicked)
        if (history === undefined) history = false;
        // send our own ajax request, and tie it into the beforeSendHandler used for jquery-ujs as well
        if (!$.rails.fire(getSection(pagination_name),"ajaxp:before",[requesturl,undefined])) return false;
        $.ajax({url: requesturl, data: {pagination:pagination_name},
          dataType: 'html',
          beforeSend: function (jqXHR,settings) {
            var result = beforeSendHandler(pagination_name,jqXHR,settings);
            if (result) {
              if (history) pushHistory(pagination_name,settings.url);
              pagination_loader_state[pagination_name] = settings.url; // remember which page number we are waiting for
            }
            return result;
          }
        });
      }
      function pushHistory(pagination_name,url) {
        var data = $("#" + pagination_name + "_paginated_section").data("pagination");
        if (data === undefined || data.history === undefined || data.history) { // check that history is not disabled
          // construct visible url
          var data = $.deparam.querystring($.url(url).attr('query'));
          delete data['pagination'];
          pagination_url = $.param.querystring(url,data,2);
          if (isReload(pagination_name,url,location.href)) History.replaceState(history_state,document.title,pagination_url);
          else { // not just a reload of current page, so do actual pushState
            // change current history state, and push it on
            if (history_state.ajax_pagination === undefined) history_state.ajax_pagination = new Array();
            var fieldname = "_" + pagination_name;
            if (history_state.ajax_pagination[fieldname] === undefined) history_state.ajax_pagination[fieldname]=1;
            else history_state.ajax_pagination[fieldname]++;
            History.pushState(history_state,document.title,pagination_url); // push state
          }
        }
      }
      // these special containers are for convenience only, to apply the required data-remote, data-pagination attributes to all links inside
      $(document).on("click", ".pagination a, .ajaxpagination a, a.ajaxpagination", function(e) {
        // ignore if already selected by jquery-ujs
        if ($(this).filter($.rails.linkClickSelector).length>0) return true; // continue with jquery-ujs - this behaviour is necessary because we do not know if the jquery-ujs handler executes before or after this handler
        // find out what data-pagination should be set to
        var pagination_container = $(this).closest(".pagination, .ajaxpagination"); // container of links (use to check for data-pagination first)
        var pagination_name = pagination_container.data('pagination');
        if (pagination_name === undefined) {
          pagination_name = /^(.*)_paginated_section$/.exec($(this).closest(".paginated_section").attr("id")); // if data-pagination not present, search up the tree for a suitable section
          if (pagination_name == null) {
            
              alert("AJAX Pagination MISSING_REFERENCE:\nNo pagination section name given for link, and none could be implicitly assigned, AJAX cancelled for this request");
            
            return true; // pagination not set up properly
          }
          pagination_name = pagination_name[1];
        }
        
        // set data-remote, data-pagination
        $(this).attr({'data-remote':'true'}); // needs to be set so that the jquery-ujs selectors work
        $(this).data({'remote':'true','pagination':pagination_name}); // needs to be set because attributes only read into jquery's data memory once
        if ($(this).data('type') === undefined) { // to be moved to ajax:before filter when https://github.com/rails/jquery-ujs/pull/241 is successful, and jquery-rails minimum version updated
          $(this).data('type','html'); // AJAX Pagination requests return html be default
        }
        // stop this event from having further effect (because we do not know if jquery-ujs's event handler executed before or after us)
        e.preventDefault();
        e.stopImmediatePropagation();
        // pass it on the jquery-ujs
        $.rails.handleRemote($(this));
        return false;
      });
      $(document).on("ajax:before","a, " + $.rails.inputChangeSelector, function() {
        var pagination_name = $(this).data('pagination');
        if (pagination_name === undefined) return true; // this is not an AJAX Pagination AJAX request
        $(this).data('params',$.extend($(this).data('params'),{'pagination':pagination_name})); // add data-pagination to the params data
        return $.rails.fire(getSection(pagination_name),"ajaxp:before",[this.href,$(this).data('method')]);
      });
      $(document).on("ajax:before","form", function() {
        var pagination_name = $(this).data('pagination');
        if (pagination_name === undefined) return true; // this is not an AJAX Pagination AJAX request
        // alter action to include pagination parameter in the GET part of the action url
        $(this).attr('action',$.param.querystring($(this).attr('action'),{pagination:pagination_name}));
        return $.rails.fire(getSection(pagination_name),"ajaxp:before",[$(this).attr('action'),$(this).data('method')]);
      });
      $(document).on("ajax:beforeSend","a, form, " + $.rails.inputChangeSelector, function (e,jqXHR,settings) {
        var pagination_name = $(this).data('pagination');
        if (pagination_name === undefined) return true; // this is not an AJAX Pagination AJAX request
        if (beforeSendHandler(pagination_name,jqXHR,settings)) {
          pushHistory(pagination_name,settings.url);
          pagination_loader_state[pagination_name] = settings.url;
        }
        return true;
      });
      History.Adapter.bind(window,'popstate',function(e){ // popstate, but can work with hash changes as well
        //var from = pagination_url, to = location.href; // from what state to what other state
        var state = History.getState().data || {};
        state.ajax_pagination = state.ajax_pagination || {};
        history_state.ajax_pagination = history_state.ajax_pagination || {};
        if (!state.ajax_pagination_set) { // page first visited (if refresh, state remains)
          state.ajax_pagination = history_state.ajax_pagination; // put current known state in
          state.ajax_pagination_set = true; // special flag so that we know its touched
          History.replaceState(state,document.title,location.href);
          return;
        }
        var allsections = {};
        for (var field in state.ajax_pagination) {
          //if (getSection(field.substr(1)).length == 0) delete state.ajax_pagination[field]; // section no longer exists in current page, so can be deleted
          // edit it cannot be deleted anymore, because if history changes, section tree node not necessarily reloaded
          allsections[field] = true;
        }
        for (var field in history_state.ajax_pagination) allsections[field] = true;

        var changedsections = new Array();
        for (var section in allsections) {
          var from = history_state.ajax_pagination[section] || 0;
          var to = state.ajax_pagination[section] || 0;
          if (from != to) {
            // schedule for loading only if not a refresh (changing browser history does not cause a refresh unless it is explicitly requested)
//alert('testing ' + section);
            if (!isReload(section.substr(1),location.href,pagination_url)) changedsections.push(section.substr(1)); // this section changed
          }
        }
        history_state = state; // we can update our view of the state now

        changedsections.sort(); // sort the pagination_names stored in array
        for (var i = 0; i < changedsections.length; i++) {
          var section = getSection(changedsections[i]);
          if (section.length == 0) continue; // no longer exists on page (meaning it does not need reloading)
          var parentsections = getSectionNames(section.parents(".paginated_section"));
          parentsections.sort();
          // check for intersection
          if (!intersects(changedsections,parentsections)) { // no intersection, load new content in this section
            swapPage(changedsections[i],location.href);
          }
        }

        pagination_url = location.href; // update url (new url recognised)
      });

      History.Adapter.trigger(window,"popstate"); // update stuff on page load

      // trigger a loaded event on each section on initial page load
      $.rails.fire($(".paginated_section"),"ajaxp:loaded");
    }
    else {
      // AJAX Pagination is disabled, we need to tidy up a few things to keep things working

      // remove remote attribute globally
      $("a[data-pagination]").removeData('remote');
      $("a[data-pagination]").removeAttr('data-remote');
      $("form[data-pagination]").removeData('remote');
      $("form[data-pagination]").removeAttr('data-remote');

      // set an event handler to remove the remote attribute if new content is loaded with AJAX Pagination
      $(document).children().add(".paginated_section").delegate("a, input, form","click.rails change.rails submit.rails", function(event) {
        var element = $(event.target);
        if (element.data('pagination') === undefined) return true;
        else {
          element.removeData('remote');
          element.removeAttr('data-remote');
        }
      }); // note using delegate for this instance for backwards compatibility, since might be disabled due to old jQuery version

    }
  })( jQuery );
});
