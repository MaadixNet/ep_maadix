/*!
 * slimtable ( http://slimtable.mcfish.org/ )
 *
 * Licensed under MIT license.
 *
 * @version 1.3.1
 * @author Pekka Harjamäki
 */

(function ($) {
  'use strict';

  var SlimTable = {
    /* ******************************************************************* *
     * Class initializer
     * ******************************************************************* */
    init: function ($el, options) {
      $el.data('slimTableObj', this);

      this.settings = $.extend(
        {
          tableData: null,
          dataUrl: null,

          itemsPerPage: 10,
          ippList: [5, 10, 20],
          pagingStart: 0,

          keepAttrs: [],
          sortList: [],
          colSettings: [],

          text1: 'items/page',
          text2: 'Loading...',

          sortStartCB: null,
          sortEndCB: null,
        },
        options
      );

      this.state = {
        showLoader: false,
        cleanerDiv: $('<div></div>'),

        colSettings: [],
        tblData: [],
        sortList: this.settings.sortList.length > 0 ? this.settings.sortList : [],

        pagingStart: parseInt(this.settings.pagingStart),
        itemsPerPage: parseInt(this.settings.itemsPerPage),
        tableHeads: $el.find('thead tr th'),
        tableBody: $el.find('tbody'),
      };

      // First we need to find both thead and tbody
      if (this.state.tableHeads.length === 0 || this.state.tableBody.length === 0) {
        this.showError('thead/tbody missing from table!');
        return;
      }

      // Read table headers + data
      this.parseColSettings();
      this.readTable();

      if (this.state.showLoader === false && !this.sanityCheck()) {
        this.showError('Different number of columns in header and data!');
        return;
      }

      // Add sort bindings & paging buttons
      $el.addClass('slimtable');
      this.addSortIcons();
      this.addPaging($el);

      //
      this.doSorting();
    },

    parseColSettings: function () {
      var l1, l2, t_obj;

      for (l1 = 0; l1 < this.state.tableHeads.length; l1++) {
        this.state.colSettings[l1] = {
          enableSort: true,
          classes: [],
          stripHtml: false,
          sortDir: 'desc',
          rowType: -1,
          colNumber: l1,
        };

        // has user set any custom settings to columns?
        for (l2 = 0; l2 < this.settings.colSettings.length; l2++) {
          t_obj = this.settings.colSettings[l2];
          if (t_obj.colNumber != l1) continue;

          if (t_obj.enableSort === false) this.state.colSettings[l1].enableSort = false;

          if (t_obj.stripHtml === true) this.state.colSettings[l1].stripHtml = true;

          if (t_obj.sortDir == 'asc' || t_obj.sortDir == 'desc') this.state.colSettings[l1].sortDir = t_obj.sortDir;

          if (t_obj.rowType >= 0) this.state.colSettings[l1].rowType = t_obj.rowType;

          if (t_obj.addClasses && t_obj.addClasses.length > 0) this.state.colSettings[l1].classes = t_obj.addClasses;

          break;
        }
      }
    },

    returnRowType: function (data) {
      var patt_01 = /[^0-9]/g,
        patt_02 = /^[0-9]+([\.,][0-9]+)?$/,
        patt_03 = /^([0-9]+([\.,][0-9]+)?)\s*[%$€£e]?$/,
        patt_04 = /^[0-9]{1,2}[.-\/][0-9]{1,2}[.-\/][0-9]{4}$/;

      // Given element is empy
      if (data.length === 0) return -1;

      // Given element doesn't containt any other characters than numbers
      if (!patt_01.test(data)) return 1;

      // Givent element is most likely float number
      if (patt_02.test(data)) return 2;

      // Float with cleanup
      if (patt_03.test(data)) return 3;

      // Date .. maybe?
      if (patt_04.test(data)) return 4;

      // String comparison
      return 0;
    },

    /* ******************************************************************* *
     * Read data from ajax url / array / table
     * ******************************************************************* */
    readTable: function () {
      var l1, l2, matchArr, tObj, tRow, tVal, tAttr;

      // Get data either from table, pre defined array or ajax url
      if (this.settings.dataUrl && this.settings.dataUrl.length > 2) {
        this.showLoader = true;
        $.ajax({
          url: this.settings.dataUrl,
          dataType: 'json',
        })
          .done(function (data) {
            this.processData(data);
            this.showLoader = false;
            this.createTableBody();
          })
          .fail(function (par1, par2) {
            this.showError('Ajax error: ' + par2);
            return;
          });
      } else if (this.settings.tableData && this.settings.tableData.length >= 0) {
        this.processData(this.settings.tableData);
      } else {
        var self = this;
        this.state.tableBody.find('tr').each(function () {
          tRow = { data: [], attrs: [] };

          for (l1 = 0; l1 < self.settings.keepAttrs.length; l1++) {
            tVal = self.settings.keepAttrs[l1];
            tAttr = $(this).attr(tVal);

            if (typeof tAttr != 'undefined') tRow.attrs.push({ attr: tVal, value: tAttr });
          }

          $(this)
            .find('td')
            .each(function () {
              tObj = { orig: $(this).html(), attrs: [], clean: null };

              // Does td contain sort-data  attr?
              tAttr = $(this).attr('sort-data');
              if (typeof tAttr != 'undefined' && tAttr !== null) tObj.clean = tAttr;

              // Find attributes to keep
              for (l1 = 0; l1 < self.settings.keepAttrs.length; l1++) {
                tVal = self.settings.keepAttrs[l1];
                tAttr = $(this).attr(tVal);
                if (typeof tAttr != 'undefined') tObj.attrs.push({ attr: tVal, value: tAttr });
              }
              tRow.data.push(tObj);
            });

          self.state.tblData.push(tRow);
        });
      }

      //
      if (!this.sanityCheck()) return;

      /*********************** Determine col types ***********************/

      for (l1 = 0; l1 < this.state.tableHeads.length; l1++) {
        matchArr = [0, 0, 0, 0, 0];

        if (this.state.colSettings[l1].rowType == -1) {
          for (l2 = 0; l2 < this.state.tblData.length; l2++) {
            // Remove HTML, TRIM data and create array with cleaned & original data
            tObj = this.state.tblData[l2].data[l1];

            if (tObj.clean === null) {
              tObj = this.state.colSettings[l1].stripHtml ? this.state.cleanerDiv.html(tObj.orig).text() : tObj.orig;
              tObj = $.trim(tObj).toLowerCase();
              this.state.tblData[l2].data[l1].clean = tObj;
            } else {
              tObj = tObj.clean;
            }

            tAttr = this.returnRowType(tObj);
            if (tAttr > 0) matchArr[tAttr]++;
          }

          this.state.colSettings[l1].rowType = $.inArray(Math.max.apply(this, matchArr), matchArr);
        }

        // Cleanup data bases on type
        for (l2 = 0; l2 < this.state.tblData.length; l2++) {
          tAttr = this.state.colSettings[l1].rowType;
          tObj = this.state.tblData[l2].data[l1].clean;

          if (tAttr === 0) this.state.tblData[l2].data[l1].clean = String(tObj);

          // Remove end sign, change , to . and run parsefloat
          if (tAttr == 2 || tAttr == 3) this.state.tblData[l2].data[l1].clean = parseFloat(tObj.replace(',', '.'));

          // Convert values to dates
          if (tAttr == 4) {
            tObj = tObj.split(/[.\/-]/);
            this.state.tblData[l2].data[l1].clean = new Date(tObj[2], tObj[1], tObj[0]);
          }
        }
      }
    },

    processData: function (data) {
      var l1, l2, tRow;

      this.state.tblData = [];

      for (l1 = 0; l1 < data.length; l1++) {
        tRow = { data: [], attrs: [] };
        for (l2 = 0; l2 < data[l1].length; l2++) tRow.data.push({ orig: data[l1][l2], attrs: [], clean: null });
        this.state.tblData.push(tRow);
      }
    },

    /* ******************************************************************* *
     * Create table body / header
     * ******************************************************************* */
    createTableHead: function () {
      var l1, t_item1, t_item2;

      for (l1 = 0; l1 < this.state.tableHeads.length; l1++) {
        if (!this.state.colSettings[l1] || !this.state.colSettings[l1].enableSort) continue;

        t_item1 = $(this.state.tableHeads[l1]);
        t_item2 = t_item1.find('span');

        if ($.inArray(l1, this.state.sortList) < 0) {
          t_item1.removeClass('slimtable-activeth');
          t_item2.removeClass('slimtable-sortasc').removeClass('slimtable-sortdesc').addClass('slimtable-sortboth');
        } else {
          t_item1.addClass('slimtable-activeth');
          t_item2
            .removeClass('slimtable-sortboth')
            .removeClass('slimtable-sort' + (this.state.colSettings[l1].sortDir == 'asc' ? 'desc' : 'asc'))
            .addClass('slimtable-sort' + this.state.colSettings[l1].sortDir);
        }
      }
    },

    createTableBody: function () {
      var end_pos = this.state.pagingStart + this.state.itemsPerPage,
        t_cobj,
        t_obj1,
        t_obj2,
        pages = Math.ceil(this.state.tblData.length / this.state.itemsPerPage),
        l1,
        l2,
        l3;

      //
      this.state.tableBody.empty();
      end_pos = end_pos > this.state.tblData.length ? this.state.tblData.length : end_pos;

      //
      for (l1 = this.state.pagingStart; l1 < end_pos; l1++) {
        t_obj1 = $('<tr></tr>');

        // Restore attributes to TR
        for (l3 = 0; l3 < this.state.tblData[l1].attrs.length; l3++) $(t_obj1).attr(this.state.tblData[l1].attrs[l3].attr, this.state.tblData[l1].attrs[l3].value);

        // Create TD elements
        for (l2 = 0; l2 < this.state.tblData[l1].data.length; l2++) {
          t_cobj = this.state.tblData[l1].data[l2];

          // Create TD element
          t_obj2 = $('<td></td>').html(t_cobj.orig);

          // Restore attributes
          for (l3 = 0; l3 < t_cobj.attrs.length; l3++) $(t_obj2).attr(t_cobj.attrs[l3].attr, t_cobj.attrs[l3].value);

          // Add extra css classes to td
          for (l3 = 0; l3 < this.state.colSettings[l2].classes.length; l3++) $(t_obj2).addClass(this.state.colSettings[l2].classes[l3]);

          // Add td to tr
          $(t_obj1).append(t_obj2);
        }

        this.state.tableBody.append(t_obj1);
      }

      // Create paging buttons
      $(this.state.btnContainer).empty();
      for (l1 = 0; l1 < pages; l1++) {
        t_obj1 = document.createElement('div');
        $(t_obj1)
          .addClass('slimtable-page-btn')
          .on('click', { self: this }, this.handlePageChange)
          .text(l1 + 1);

        if (l1 * this.state.itemsPerPage == this.state.pagingStart) $(t_obj1).addClass('active');

        $(this.state.btnContainer).append(t_obj1);
      }
    },

    /* ******************************************************************* *
     * Add sorting icons / buttons
     * ******************************************************************* */
    addSortIcons: function () {
      var tCfg,
        self = this;

      this.state.tableHeads.each(function (index) {
        $(this).attr('unselectable', 'on');

        tCfg = self.state.colSettings[index];

        if (tCfg && tCfg.enableSort) {
          var tObj = $('<span></span>').attr('unselectable', 'on').addClass('slimtable-sprites');

          if (tCfg.sortDir == 'asc') {
            tObj.addClass('slimtable-sortasc');
          } else if (tCfg.sortDir == 'desc') {
            tObj.addClass('slimtable-sortdesc');
          } else {
            tObj.addClass('slimtable-sortboth');
          }

          $(this).prepend(tObj).css({ cursor: 'pointer' }).on('click', { self: self }, self.handleHeaderClick);
        } else {
          $(this).addClass('slimtable-unsortable');
        }
      });
    },

    addPaging: function (tblObj) {
      var tObj1, tObj2, l1, selector;

      //
      selector = $('<select></select>').addClass('slimtable-paging-select').on('change', { self: this }, this.handleIppChange);

      for (l1 = 0; l1 < this.settings.ippList.length; l1++) {
        tObj1 = this.settings.ippList[l1];
        tObj2 = $('<option></option>').val(tObj1).text(tObj1);

        if (tObj1 == this.settings.itemsPerPage) tObj2.attr('selected', 'selected');

        $(selector).append(tObj2);
      }

      // Create container for paging buttons
      tObj2 = $('<div></div>').addClass('slimtable-paging-btnsdiv');
      this.state.btnContainer = tObj2;

      //
      tObj1 = $('<div></div>').addClass('slimtable-paging-div').append(tObj2);

      // Create container for select
      tObj2 = $('<div></div>').addClass('slimtable-paging-seldiv').append(selector).append(this.settings.text1);
      $(tObj1).append(tObj2);

      // Move table to container div
      tObj2 = $('<div></div>').addClass('slimtable-container-div').append(tObj1);

      tblObj.before(tObj2);
      tblObj.insertBefore(tObj1);
    },

    /* ******************************************************************* *
     * Data sorting method
     * ******************************************************************* */
    doSorting: function () {
      var self = this;

      //
      if (this.state.sortList.length > 0)
        this.state.tblData.sort(function (a, b) {
          var t1,
            ta,
            tb,
            l1,
            slistLength = self.state.sortList.length,
            same_item;

          for (l1 = 0; l1 < slistLength; l1++) {
            t1 = self.state.sortList[l1];

            // Swap variables, if sortdir = ascending
            if (self.state.colSettings[t1].sortDir == 'desc') {
              ta = b.data[t1].clean;
              tb = a.data[t1].clean;
            } else {
              ta = a.data[t1].clean;
              tb = b.data[t1].clean;
            }

            // Given variables match, move to next sort parameter
            same_item = false;
            if (self.state.colSettings[t1].rowType === 0) {
              if (ta.localeCompare(tb) === 0) same_item = true;
            } else if (self.state.colSettings[t1].rowType == 4) {
              if (ta - tb === 0) same_item = true;
            } else {
              if (ta == tb) same_item = true;
            }

            //
            if (same_item && l1 < slistLength - 1) continue;

            // Compare values
            if (self.state.colSettings[t1].rowType === 0) return ta.localeCompare(tb);
            else return ta - tb;
          }
        });

      //
      this.createTableHead();
      this.createTableBody();
    },

    /* ******************************************************************* *
     * Event handlers
     * ******************************************************************* */
    handleHeaderClick: function (event) {
      var idx = $(this).index(),
        self = event.data.self,
        pos = $.inArray(idx, self.state.sortList);

      //
      event.preventDefault();

      // Execute sort start callback, if one is defined
      if (self.settings.sortStartCB && typeof self.settings.sortStartCB == 'function') self.settings.sortStartCB.call(self);

      // Shift click
      if (event.shiftKey) {
        if (pos < 0) {
          self.state.sortList.push(idx);
          self.state.colSettings[idx].sortDir = 'asc';
        } else {
          if (self.state.colSettings[idx].sortDir == 'asc') self.state.colSettings[idx].sortDir = 'desc';
          else self.state.colSettings[idx].sortDir = 'asc';
        }
      } else {
        self.state.sortList = [idx];
        if (pos < 0) {
          self.state.colSettings[idx].sortDir = 'asc';
        } else {
          if (self.state.colSettings[idx].sortDir == 'asc') self.state.colSettings[idx].sortDir = 'desc';
          else self.state.colSettings[idx].sortDir = 'asc';
        }
      }

      //
      self.doSorting();

      // Execute sort end callback, if one is defined
      if (self.settings.sortEndCB && typeof self.settings.sortEndCB == 'function') self.settings.sortEndCB.call(self);
    },

    handleIppChange: function (e) {
      var self = e.data.self;
      self.state.itemsPerPage = parseInt(this.value);
      self.state.pagingStart = 0;
      self.createTableBody();
    },

    handlePageChange: function (event) {
      var num = parseInt($(this).text()) - 1,
        self = event.data.self,
        pages = Math.ceil(self.state.tblData.length / self.state.itemsPerPage);

      if (num < 0 || num >= pages) return;

      self.state.pagingStart = num * self.state.itemsPerPage;
      self.createTableBody();
    },

    /* ******************************************************************* *
     * Structure checker & error method
     * ******************************************************************* */
    sanityCheck: function () {
      return !(this.state.tblData.length > 0 && this.state.colSettings.length != this.state.tblData[0].data.length);
    },

    showError: function (msg) {
      console.log('Slimtable: ' + msg);
    },

    /* ******************************************************************* *
     * Status getters
     * ******************************************************************* */
    getState: function ($el) {
      var slimObj = $el.data('slimTableObj'),
        state;

      if (slimObj && slimObj.state) {
        state = slimObj.state;
        return {
          colNumber: state.colNumber,
          itemsPerPage: state.itemsPerPage,
          pagingStart: state.pagingStart,
          colSettings: state.colSettings,
          sortList: state.sortList,
        };
      }

      return {};
    },
  };

  /* ******************************************************************* *
   * Plugin main
   * ******************************************************************* */
  $.fn.slimtable = function (options) {
    if (typeof options != 'undefined' && options === 'getState') return SlimTable.getState($(this[0]));

    return this.each(function () {
      var tbl = Object.create(SlimTable);
      tbl.init($(this), options);
    });
  };
})(jQuery);
