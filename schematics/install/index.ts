import { strings } from '@angular-devkit/core';
import {
  apply,
  chain,
  externalSchematic,
  FileEntry,
  forEach,
  mergeWith,
  Rule,
  SchematicContext,
  SchematicsException,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import {
  addPackageJsonDependency,
  NodeDependencyType
} from '@schematics/angular/utility/dependencies';
import { updateWorkspace } from '@schematics/angular/utility/workspace';
import { Schema as UniversalOptions } from './schema';
import { getOutputPath } from './utils';

const SERVER_DIST = 'dist/server';

function addDependenciesAndScripts(): Rule {
  return (host: Tree) => {
    addPackageJsonDependency(host, {
      type: NodeDependencyType.Default,
      name: '@nestjs/common',
      version: '^10.0.0'
    });
    addPackageJsonDependency(host, {
      type: NodeDependencyType.Default,
      name: '@nestjs/core',
      version: '^10.0.0'
    });
    addPackageJsonDependency(host, {
      type: NodeDependencyType.Default,
      name: 'reflect-metadata',
      version: '^0.1.13'
    });
    addPackageJsonDependency(host, {
      type: NodeDependencyType.Default,
      name: 'class-transformer',
      version: '^0.5.1'
    });
    addPackageJsonDependency(host, {
      type: NodeDependencyType.Default,
      name: 'class-validator',
      version: '^0.14.0'
    });
    addPackageJsonDependency(host, {
      type: NodeDependencyType.Default,
      name: '@nestjs/platform-express',
      version: '^10.0.0'
    });
    addPackageJsonDependency(host, {
      type: NodeDependencyType.Default,
      name: '@nestjs/ng-universal',
      version: '^8.0.0'
    });
    addPackageJsonDependency(host, {
      type: NodeDependencyType.Default,
      name: '@angular/ssr',
      version: '^17.0.0'
    });

    const pkgPath = '/package.json';
    const buffer = host.read(pkgPath);
    if (buffer === null) {
      throw new SchematicsException('Could not find package.json');
    }
    const pkg = JSON.parse(buffer.toString());
    pkg.scripts = {
      ...pkg.scripts,
      'prebuild:ssr': `ngcc`
    };

    host.overwrite(pkgPath, JSON.stringify(pkg, null, 2));
  };
}

function addFiles(options: UniversalOptions): Rule {
  return async (tree: Tree, _context: SchematicContext) => {
    const browserDistDirectory = await getOutputPath(
      tree,
      options.project,
      'build'
    );
    const rule = mergeWith(
      apply(url('./files/root'), [
        template({
          ...strings,
          ...(options as object),
          stripTsExtension: (s: string) => s.replace(/\.ts$/, ''),
          getBrowserDistDirectory: () => browserDistDirectory,
          getServerDistDirectory: () => SERVER_DIST,
          getClientProjectName: () => options.project
        }),
        forEach((fileEntry: FileEntry) => {
          if (tree.exists(fileEntry.path)) {
            tree.overwrite(fileEntry.path, fileEntry.content);
            return null;
          }
          return fileEntry;
        })
      ])
    );
    return rule;
  };
}

export default function (options: UniversalOptions): Rule {
  return (host: Tree, context: SchematicContext) => {
    if (!options.skipInstall) {
      context.addTask(new NodePackageInstallTask());
    }

    return chain([
      externalSchematic('@angular/ssr', 'ng-add', options),
      addFiles(options),
      addDependenciesAndScripts(),
    ]);
  };
}
