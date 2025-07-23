/* Copyright 2014 Alexander Oberegger

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License. */

(function ($, undefined) {
  var isFired = false;
  var oldReady = jQuery.fn.ready;
  $(function () {
    isFired = true;
    $(document).ready();
  });
  jQuery.fn.ready = function (fn) {
    if (fn === undefined) {
      $(document).trigger('_is_ready');
      return;
    }
    if (isFired) {
      window.setTimeout(fn, 1);
    }
    $(document).bind('_is_ready', fn);
  };
})(jQuery);
