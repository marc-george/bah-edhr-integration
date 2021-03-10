(function() {
  'use strict';

  Polymer({
    is: 'bah-edhr-integration',

    properties: {
      /**
      * Old name of AT in the data table
      */
      alertTypeInTable: {
        type: String,
        value: ''
      },
      /**
       * Alert Type hashmap
       */
      alertTypeHash: {
        type: Object
      },
      
      // Get the data in the alert type columns
      alertTypeDisplayCells:{
        type: Array,
        value:[]
      },

      // Get the data in the alert definition columns
      alertDefinitionDisplayCells:{
        type: Array,
        value:[]
      },

      /**
       * Category of integration
       */
      _integrationName: {
        type: String,
        value: 'eDHR Integration'
      },
      
      /**
       * Last row selected in mapping table
       */
       _lastRowSelected: {
         type: Number,
         value: -1
       },

      /**
       * Object used to show error or loading message within
       * integrations tab
       */
      _loadingMappings: {
        type: Object,
        value: function() {
          return {
            errorMessage: 'Unable to retrieve routes.',
            errorTitle: 'Error.',
            hasError: false,
            isLoading: false,
            loadingMessage: 'Loading routes',
            showContent: false
          };
        }
      },
      /**
      * Old name of location in the data table
      */
      locationInTable: {
        type: String,
        value: ''
      },

      /**
       * The alert definition and ids for dropdown
       * Array of objects
       */
      _mappedAlertDefinitions: {
        type: Array
      },

      /**
       * The alert types and ids for dropdown
       * Array of objects
       */
      _mappedAlertTypes: {
        type: Array
      },

      /**
       * The location names and ids for dropdown
       * Array of objects
       */
      _mappedLocations: {
        type: Array
      },

      /**
       * All alert definitions for a selected site
       */
      unmappedAlertDefinitions: {
        type: Array,
        observer: '_mapAlertDefinitions'
      },

      /**
       * All alert types for a selected site
       */
      unmappedAlertTypes: {
        type: Array,
        observer: '_mapAlertTypes'
      },

      /**
       * The locations for a selected site
       */
      unmappedLocations: {
        type: Array,
        observer: '_mapLocations'
      },

      _selectedLocation: {
        type: String
      },

      /**
       * The selected site from the site selector
       */
      selectedSite: {
        type: Object,
        observer: '_getRouteMappingsForSite'
      },

      /**
       * Used to populate the data ingestion mapping table
       */
      _routeMappingsData: {
        type: Object,
        value: [],
        notify: true
      },

      rootUrl: {
        type: String,
        value: '/eandon/integration'
      },

      token: {
        type: String
      },

      /**
       * Used to write mappings back to DB
       */
      _updatedRouteMapping: {
        type: Object,
        value: [],
        notify: true
      }
    },

    listeners: {
      'px-cell-click': '_setSelectedVariables',
      'btn-modal-positive-clicked': '_showModal',
      'btn-modal-negative-clicked': '_showModal'
    },

    /**
     * Get all route mappings for site for data ingestion
     * @param {Object} selectedSite
     * @return {Array}
     */
    _getRouteMappingsForSite: function(selectedSite) {
      var _this = this;
      var promise;
      if (selectedSite && selectedSite.id && _this.unmappedLocations && _this.unmappedLocations.length > 0) {
        // show loading
        _this.set('_loadingMappings.isLoading', true);
        _this.set('_loadingMappings.hasError', false);
        _this.set('_routeMappingsData', []);
        // create promise
        promise = _this.$.sourceAlertService.getSourceMappingsBySiteId(_this.selectedSite.id);
        // promise handler
        promise.then(
          function(response) {
            if(response.data.length == 0) {
              var noData = new CustomEvent('noEdhrData', {detail: true});
               //  dispatch the event
               _this.dispatchEvent(noData);
            }
            // no mappings found
            var routeData = [];
            _.forEach(response.data, function(item, idx){
              try {
                var loc;
                var ad;
                if(item.alertDefinitionId !== null && item.alertDefinitionId !== undefined) {
                  ad = _.find(_this.unmappedAlertDefinitions, {'id': item.alertDefinitionId});
                  if(ad !== undefined) {
                    loc = _.find(_this.unmappedLocations, {'id': ad.locationId}).name;
                  }
                }
                if(item.alertDefinitionId == null){
                  routeData.push({
                    id: item.id,
                    sourceId: item.sourceId,
                    sourceName: item.sourceName,
                    siteId: item.siteId,
                    locationId: 'Select Location',
                    alertType: 'Select Alert Type',
                    alertDefinitionId: 'Select Alert Definition',
                    integration: item.integration
                  });
                } else {
                  routeData.push({
                    id: item.id,
                    sourceId: item.sourceId,
                    sourceName: item.sourceName,
                    siteId: item.siteId,
                    locationId: loc ? loc : 'Select Location',
                    alertType: ad.alertType ? ad.alertType.name : 'Select Alert Type',
                    alertDefinitionId: ad ? ad.name : 'Select Alert Definition',
                    integration: item.integration
                  });
                }
              } catch (e){
                console.log('try catch error: ', e);
              }
            });
            routeData = _.sortBy(routeData, 'alertDefinitionId');
            if (response.data.length === 0) {            
              _this.set('_loadingMappings.isLoading', false);
              _this.set('_loadingMappings.hasError', true);
              _this.set('_loadingMappings.errorMessage', 'No mappings found for this site');
            } else {
              _this.set('_routeMappingsData', routeData);
              _this.set('_loadingMappings.isLoading', false);
              _this.set('_loadingMappings.hasError', false);
            }
          },
          function(error) {
            _this.set('_loadingMappings.isLoading', false);
            _this.set('_loadingMappings.hasError', true);
            if (error && error.message) {
              try {
                _this._notifyUser(error);
              } catch (e) {
                _this.$.bahUtility.alert(
                  'Error',
                  'There was an error retrieving mappings for this site.'
                );
              }
            } else {
              _this.$.bahUtility.alert(
                'Error',
                'There was an error retrieving mappings for this site.'
              );
            }
          }
        );
      }
      return promise;
    },

    /**
     * Map location dropdown to location name
     *
     * @param {Array} unmappedAlertDefinitions
     */
    _mapAlertDefinitions: function(unmappedAlertDefinitions) {
      if (unmappedAlertDefinitions && unmappedAlertDefinitions.length > 0) {
        var alertDefObj = unmappedAlertDefinitions.map(function(unmappedAlertDefinition) {
          return {'key': unmappedAlertDefinition.id, 'val': unmappedAlertDefinition.name};
        });
        this.set('_mappedAlertDefinitions', alertDefObj);
      }
    },

    /**
     * Map all alert types for sites
     * for use in table
     *
     * @param {Array} unmappedAlertTypes
     */
    _mapAlertTypes: function(unmappedAlertTypes) {
      var _this = this;
      if (unmappedAlertTypes && unmappedAlertTypes.length > 0) {
        var alertTypeObj = unmappedAlertTypes.map(function(unmappedAlertType) {
          return {'key': unmappedAlertType.id, 'val': unmappedAlertType.name};
        });
        _this.set('_mappedAlertTypes', alertTypeObj);
      }
    },

    /**
     * Map location dropdown to location name
     *
     * @param {Array} unmappedLocations
     */
    _mapLocations: function(unmappedLocations) {
      this._getRouteMappingsForSite(this.selectedSite);
      if (unmappedLocations && unmappedLocations.length > 0) {
        var locationObj = unmappedLocations.map(function(unmappedLocation) {
          return {'key': unmappedLocation.id, 'val': unmappedLocation.name};
        });
        // Provide the users a way to clear their selection
        locationObj.unshift({'key': 'Select Location ', 'val': 'Select Location '});
        this.set('_mappedLocations', locationObj);
      }
    },

    _saveRouteMappings: function() {
      var _this = this;
      var promise;
      var configuredRoutes = [];

      for (var j = 0; j < _this._routeMappingsData.length; j++) {
        var rowData = _this._routeMappingsData[j];
        if (rowData.locationId === 'Select Location ') {
          // The user cleared the location/alert mapping, set the definition ID back to null
          var obj = _this._routeMappingsData[j];
          obj.alertDefinitionId = null;
          configuredRoutes.push(obj);
        } else if (rowData.locationId !== 'Select Location' &&
            rowData.alertDefinitionId !== 'Select Alert Definition' &&
            rowData.alertType !== 'Select Alert Type') {
          for (var i = 0; i < _this.alertTypeHash[rowData.locationId].ad.length; i++) {
            if(_this.alertTypeHash[rowData.locationId].ad[i].type === rowData.alertType &&
              _this.alertTypeHash[rowData.locationId].ad[i].def === rowData.alertDefinitionId) {
              var obj = _this._routeMappingsData[j];
              obj.alertDefinitionId = _this.alertTypeHash[rowData.locationId].ad[i].defId;
              configuredRoutes.push(obj);
            }
          }
        }
      }

      _this.$.bahUtility.alert('Info', 'Saving route mappings');
      // create promise
      promise = _this.$.sourceAlertService.updateSourceMappings(configuredRoutes);
      // promise handler
      promise.then(function(response) {
        _this.$.bahUtility.alert('Success', 'Successfully added route mappings');
      }, function (error) {
        if (error && error.message) {
          try {
            _this._notifyUser(error);
          } catch (e) {
            _this.$.bahUtility.alert('Error', 'There was an error adding or updating route mappings');
          }
        } else {
          _this.$.bahUtility.alert('Error', 'There was an error adding or updating route mappings');
        }
      });

      return promise;
    },

    /**
     * Set dropdowns
     * Based on previous selections
     *
     * @param {Object} e
     */
    _setSelectedVariables: function(e) {
      // a cell was edited so broadcast event
      var cellEditEvent = new CustomEvent('dataEdited', {detail: true});
      //  dispatch the event
      this.dispatchEvent(cellEditEvent);
      // get the index of the row clicked
      var indexClicked = e.detail.row.row.dataIndex;
      // The data is filtered, so check the filtered sorted data array in the element
      if(document.getElementById('routeMappingTable').tableData.length > e.srcElement.filteredSortedData.length) {
        indexClicked = _.findIndex(e.srcElement.filteredSortedData, { row: { dataIndex: indexClicked } });
      }
      // Get the size of the pagination of the table
      var pageSize = document.getElementById('pagination').pageSize;
      // Get the current page based on the index the user selected
      var page = (indexClicked+1) / pageSize;
      // Based on their page, find out which element on the page is actually selected
      var paginatedIndexClicked = indexClicked % pageSize;
      // Check if we have to get the paginated data to manipulate displayed values
      if(this._lastPageClicked != page || this.alertTypeDisplayCells.length == 0){
        // Get the current table data for manipulation
        this.alertTypeDisplayCells = document.querySelectorAll('.aha-alertType-td');
      }
      // Check if we have to get the paginated data to manipulate displayed values
      if(this._lastPageClicked != page || this.alertDefinitionDisplayCells.length == 0){
        // Get the current table data for manipulation
        this.alertDefinitionDisplayCells = document.querySelectorAll('.aha-alertDefinitionId-td');
      }
      // Save the current page for next use click
      this._lastPageClicked = page;
      // Find which column the user has clicked
      var column = e.detail.column.name;
      // Check if the user selected the location dropdown
      if (column === 'locationId') {
        // Set the selected location based on user input
        this.set('_selectedLocation', e.detail.row.row.locationId.value);
        // find the location of the row that was clicked
        var locationClicked = document.getElementById('routeMappingTable').tableData[indexClicked].locationId;
        // See if this location was changed
        if(this.locationInTable !== '' && this.locationInTable !== locationClicked && locationClicked !== 'Select Location' && this._lastRowSelected == paginatedIndexClicked){
          // Location was changed so reset the alert type cell in this row
          this.alertTypeDisplayCells[paginatedIndexClicked].cellDisplayValue  = 'Select Alert Type ';
          this.alertTypeDisplayCells[paginatedIndexClicked].cellValue = 'Select Alert Type';
          // Event object to save px-data-cell
          var obj = {};
          obj.target = {};
          obj.target.value = 'Select Alert Type ';
          // Save the updates
          this.alertTypeDisplayCells[paginatedIndexClicked].saveCell(obj);
          // Location was changed so reset the alert definition cell in this row
          this.alertDefinitionDisplayCells[paginatedIndexClicked].cellDisplayValue  = 'Select Alert Definition ';
          this.alertDefinitionDisplayCells[paginatedIndexClicked].cellValue = 'Select Alert Definition';
          // Event object to save px-data-cell
          var obj = {};
          obj.target = {};
          obj.target.value = 'Select Alert Definition ';
          // Save the updates
          this.alertDefinitionDisplayCells[paginatedIndexClicked].saveCell(obj);
        }
        // Store the new location to reference on next cell click
        this.locationInTable = e.detail.row.row.locationId.value;   
        // Store the row that they selected
        this._lastRowSelected = paginatedIndexClicked; 
      }
      // Check if the user selected the alert type drop down
      if (column === 'alertType') {
        // Get the alert type clicked by the user
        var atClicked = document.getElementById('routeMappingTable').tableData[indexClicked].alertType;
        // Compare that alert type to see if the user changed alert types
        if(this.alertTypeInTable !== '' && this.alertTypeInTable !== atClicked && atClicked !== 'Select Alert Type'){
          // If they changed alert types, reset the alert definition cell in this row
          this.alertDefinitionDisplayCells[paginatedIndexClicked].cellDisplayValue  = 'Select Alert Definition ';
          this.alertDefinitionDisplayCells[paginatedIndexClicked].cellValue = 'Select Alert Definition';
          // Event object to save px-data-cell
          var obj = {};
          obj.target = {};
          obj.target.value = 'Select Alert Definition ';
          // Save the updates
          this.alertDefinitionDisplayCells[paginatedIndexClicked].saveCell(obj);
        }
        // Store the new alert type to reference on next cell click
        this.alertTypeInTable = e.detail.row.row.alertType.value;

         // Modify the inner html of the cell so the correct value is being displayed
        if(this.alertTypeDisplayCells[paginatedIndexClicked].cellDisplayValue  !== 'Select Alert Type '){
          this.alertTypeDisplayCells[paginatedIndexClicked].cellDisplayValue = atClicked;
          // Event object to save px-data-cell
          var obj = {};
          obj.target = {};
          obj.target.value = atClicked;
          // Save the updates
          this.alertTypeDisplayCells[paginatedIndexClicked].saveCell(obj);
        } else {
          this.alertTypeDisplayCells[paginatedIndexClicked].cellDisplayValue  = 'Select Alert Type ';
          this.alertTypeDisplayCells[paginatedIndexClicked].cellValue = 'Select Alert Type';
          // Event object to save px-data-cell
          var obj = {};
          obj.target = {};
          obj.target.value = 'Select Alert Type ';
          // Save the updates
          this.alertTypeDisplayCells[paginatedIndexClicked].saveCell(obj);
        }
        if(this.alertTypeHash[e.detail.row.row.locationId.value]) {
          // Set Alert Type dropdown items based on the location that was selected
          document.querySelector('.aha-alertType-td').querySelector('.px-dropdown-content').items = _.uniq(this.alertTypeHash[e.detail.row.row.locationId.value].types);
        } else {
          document.querySelector('.aha-alertType-td').querySelector('.px-dropdown-content').items = [];
        }
      }
      // Check if the user selected the alert definition dropdown
      if (column === 'alertDefinitionId') {
        // Modify the inner html of the cell so the correct value is being displayed
        if(this.alertDefinitionDisplayCells[paginatedIndexClicked].cellDisplayValue  !== 'Select Alert Definition '){
          this.alertDefinitionDisplayCells[paginatedIndexClicked].cellDisplayValue= this.alertDefinitionDisplayCells[paginatedIndexClicked].cellValue;
          // Event object to save px-data-cell
          var obj = {};
          obj.target = {};
          obj.target.value = this.alertDefinitionDisplayCells[paginatedIndexClicked].cellValue;;
          // Save the updates
          this.alertDefinitionDisplayCells[paginatedIndexClicked].saveCell(obj);
        } else {
          this.alertDefinitionDisplayCells[paginatedIndexClicked].cellDisplayValue = 'Select Alert Definition';
          // Event object to save px-data-cell
          var obj = {};
          obj.target = {};
          obj.target.value = 'Select Alert Definition ';
          // Save the updates
          this.alertDefinitionDisplayCells[paginatedIndexClicked].saveCell(obj);
        }
        var ads = [];
        if (e.detail.row.row.locationId.value === 'Select Location' || e.detail.row.row.alertType.value === 'Select Alert Type') {
          document.querySelector('.aha-alertDefinitionId-td').querySelector('.px-dropdown-content').items = [];
          return;
        }
        for (var i = 0; i < this.alertTypeHash[e.detail.row.row.locationId.value].ad.length; i++) {
          if (this.alertTypeHash[e.detail.row.row.locationId.value].ad[i].type === e.detail.row.row.alertType.value) {
            ads.push(this.alertTypeHash[e.detail.row.row.locationId.value].ad[i].def);
          }
        }
        document.querySelector('.aha-alertDefinitionId-td').querySelector('.px-dropdown-content').items = ads;
        this.set('_selectedLocation', e.detail.row.row.locationId.value);
      }
      document.getElementById('pagination').goToPageNumber(Math.ceil(page));
    },

    /**
     * Show the modal when button is clicked
     */
    _showModal: function () {
      this.$.cancelModal.modalButtonClicked();
    },

    /**
     * When the API returns an error message, we want to use that
     * to inform the user of errors
     * @param {Object} error
     */
    _notifyUser: function(error) {
      if (typeof error.message === 'string') {
        var parsedMessage = JSON.parse(error.message);
        this.$.bahUtility.alert('Error', parsedMessage.message);
      } else if (typeof error.message === 'object') {
        this.$.bahUtility.alert('Error', error.message.message);
      }
    }
  });
})();
