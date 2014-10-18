'use strict';

module.exports = function(grunt) {
	grunt.initConfig({
  	pkg: grunt.file.readJSON('package.json'),
  	jshint: {
    	files: {
    		src: ['Gruntfile.js', 'ravel-mysql-provider.js']
    	},
	    options: {
	    	force: true,
	      reporter:  require('jshint-stylish'),
	      bitwise:   true,
	      eqeqeq:    true,
	      curly:     true,
	      immed:     true,
	      latedef:   true,
	      newcap:    true,
	      noarg:     true,
	      noempty:   true,
	      nonbsp:    true,
	      nonew:     true,
	      sub:       true,
	      undef:     true,
	      unused:    true,
	      boss:      true,
	      eqnull:    true,
	      node:      true,
	      jquery:    true,
	      quotmark: 'single',
	      camelcase: true,
	      strict:    true,
	      indent: 2,
	      //maxdepth:  4,
	      ignores: ['node_modules/**']
	    }
	  },
	  watch: {
	  	api: {
	  		files: ['Gruntfile.js', 'ravel-mysql-provider.js'],
	  		tasks: ['jshint'],
	  		options: {
	  			spawn: false
	  		}
	  	}
	  }
	});

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('default', ['jshint', 'watch']);
};
