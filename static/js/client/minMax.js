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

/*
 * Minimize and Maximize of the Header, groupNav und Footer Element in Pad View
 *
 */

$(document).ready(function () {
  // minimize the elements
  $('#minimize').click(function () {
    $('header').delay(0).slideUp(800);
    $('#groupNav').delay(0).slideUp(800);
    $('footer').delay(0).slideUp(800);
    $('#minimize').delay(0).slideUp(800);
    $('#maximize').delay(1200).slideDown(800);
  });

  // maximize the elements
  $('#maximize').click(function () {
    $('header').delay(300).slideDown(800);
    $('#groupNav').delay(300).slideDown(800);
    $('footer').delay(300).slideDown(800);
    $('#minimize').delay(1500).slideDown(800);
    $('#maximize').delay(0).slideUp(800);
  });
});
