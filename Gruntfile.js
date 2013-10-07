'use strict';

module.exports = function(grunt) {

	// load all grunt tasks
	require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

	grunt.initConfig({
		config: grunt.file.readJSON('config-dev.json'),
		connect: {
			dev: {
				options: {
					port: '<%= config.port %>',
					middleware: function(connect, options) {
						return [
							// serve files in /dist as if they were in the root.
							connect.static(__dirname + '/build/www'),
							// but serve everything else from the root
							connect.static(__dirname)
						];
					}
				}
			},
			prod: {
				options: {
					base: '<%= config.buildPath %>',
					keepalive: true,
				}
			}
		},
		copy: {
			build: {
				files: [
					{expand: true, src: ['CNAME'], dest: '<%= config.buildPath %>/'},
					{expand: true, cwd: 'components', src: ['fancybox/source/**/*'], dest: '<%= config.buildPath %>/components'},
					{expand: true, cwd: 'sass', src: 'assets/**/*', dest: '<%= config.buildPath %>/css/'}
				]
			},
			// copy images for dev, optimize using imagemin only for production
			images: {
				files : [
					{expand: true, cwd: 'contents', src: '**/*.{jpg,png,gif}', dest: '<%= config.buildPath%>/'}
				]
			}
		},
		imagemin: {
			build: {
				files: [
					{expand: true, cwd: 'contents', src: '**/*.{jpg,png,gif}', dest: '<%= config.buildPath %>/'}
				]
			}
		},
		responsive_images: {
			build: {
				options: {
					sizes: [{
						name: 'small',
						width: 500
					}, {
						name: 'medium',
						width: 800
					}]
				},
				files: [
					{expand: true, cwd: '<%= config.buildPath %>', src: '**/*.{jpg,png}', dest: '<%= config.buildPath %>'}
				]
			}
		},
		handlebars_html: {
			options : {
				partialDir : 'templates/partials',
				helperDir : 'templates/helpers'
			},
			dev: {
				src: 'templates/*.hbs',
				dest: '<%= config.buildPath %>',
				data: 'build/data.json',
			},
			prod: '<%= handlebars_html.dev %>'
		},
		import_contents: {
			options : {
				baseDir: 'contents',
				config : 'config.json',
				markdown: {
					breaks: true,
					smartLists: true,
					smartypants: true,
					langPrefix: 'language-'
				},
				paginate: [
					{
						dir: 'articles',
						postPerPage: 4,
						template: 'archive.hbs',
						title: 'Articles'
					}
				]
			},
			all: {
				src: 'contents/**/*.{json,md}',
				dest: 'build/data.json'
			}
		},
		requirejs: {
			prod: {
				options: {
					baseUrl: '.',
					mainConfigFile: 'js/config.js',
					name: 'components/almond/almond',
					insertRequire: ['js/app'],
					out: '<%= config.buildPath %>/app.js',
					optimize: 'uglify2',
					generateSourceMaps: true,
					preserveLicenseComments: false,
				}
			}
		},
		sass: {
			dev: {
				options: {
					style: 'expanded',
					sourcemap: true
				},
				files: {
					'<%= config.buildPath %>/css/main.css': 'sass/main.scss'
				}
			},
			prod: {
				options: {
					style: 'compressed'
				},
				files: {
					'<%= config.buildPath %>/css/main.css': 'sass/main.scss'
				}
			}
		},
		autoprefixer: {
			dev: {
				src: '<%= config.buildPath %>/css/main.css',
				dest: '<%= config.buildPath %>/css/main.css'
			}
		},
		csso: {
			prod: {
				src: '<%= config.buildPath %>/css/main.css',
				dest: '<%= config.buildPath %>/css/main.css'
			}
		},
		fix_sourcemaps: {
			prod: ['<%= config.buildPath %>/app.js.map']
		},
		'gh-pages': {
			prod: {
				options: {
					base: '<%= config.buildPath %>',
					branch: 'master',
					repo: 'git@github.com:tnguyen14/tnguyen14.github.io.git'
				},
				src: ['**/*']
			}
		},
		watch: {
			options: {
				livereload: '<%= config.livereload %>' || 35729
			},
			css: {
				files: ['sass/**/*.scss'],
				tasks: ['sass:dev', 'autoprefixer:dev']
			},
			contents: {
				files: ['contents/**/*.{json,md}'],
				tasks: ['process']
			},
			templates: {
				files: ['templates/**/*.{hbs,html}'],
				tasks: ['handlebars_html:dev']
			},
			images: {
				files: ['contents/**/*.{jpg,png}', 'sass/assets/'],
				tasks: ['copy']
			},
			grunt: {
				files: ['tasks/**/*.js', 'Gruntfile.js'],
				tasks: ['process']
			}
		}
	});

	// load local tasks
	grunt.loadTasks('tasks');

	// copied from https://github.com/cowboy/wesbos/blob/master/Gruntfile.js
	grunt.registerMultiTask('fix_sourcemaps', 'Fix sourcemaps generated by requirejs task.', function() {
		if (this.filesSrc.length === 0) {
			grunt.log.warn('No sourcemap files found.');
		}
		this.filesSrc.forEach(function(mapfile) {
			var data = grunt.file.readJSON(mapfile);
			// Sources should be relative to the project root, but are actually
			// relative to where app.js lives. I'm not sure how to change this,
			// other than to rewrite ../ and ../../ (and ../ times 8 for !json??)
			var table = [];
			data.sources = data.sources.map(function(filepath) {
				// Fix path parts.
				var adjusted = filepath.replace(/^(\.\.\/)+/, function(parents) {
					var depth = parents.match(/\.\.\//g).length - 1;
					return ['build/', ''][depth] || '';
				});
				// Move plugin name from path-prefix to filename-prefix.
				adjusted = adjusted.replace(/(.+)!(.*)/, function(_, plugin, path) {
					var parts = path.split('/');
					return parts.concat(plugin + '__' + parts.pop()).join('/');
				});
				table.push([filepath, '→', adjusted]);
				return adjusted;
			});

			// Maybe this should go into grunt.log somewhere.
			var widths = table.reduce(function(max, s) {
				return s.map(function(s, i) { return Math.max(max[i] || 0, s.length + 1); });
			}, []);
			table.forEach(grunt.log.writetableln.bind(null, widths));

			grunt.file.write(mapfile, JSON.stringify(data));
		});
	});


	grunt.registerTask('process', 'Process content files, render html and compile css', [
		'import_contents',
		'copy:images',
		'copy:build',
		'handlebars_html:dev',
		'sass:dev',
		'autoprefixer:dev'
	]);

	grunt.registerTask('dev', [
		'process',
		'responsive_images',
		'connect:dev',
		'watch'
	]);

	grunt.registerTask('build', [
		'import_contents',
		'imagemin:build',
		'responsive_images',
		'copy:build',
		'handlebars_html:prod',
		'sass:prod',
		'autoprefixer',
		'csso:prod',
		'requirejs:prod',
		'fix_sourcemaps:prod'
	]);

	grunt.registerTask('deploy', 'Deploy site via gh-pages.', [
		'build',
		'gh-pages'
	])

	grunt.registerTask('default', ['dev']);
}