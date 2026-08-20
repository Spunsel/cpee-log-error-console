/*
 * The following code is derived from the CPEE project:
 * https://github.com/etm/CPEE/tree/cpee2/cockpit/themes
 *
 * Copyright (c) Juergen Mangler and the CPEE contributors.
 * Licensed under the GNU Lesser General Public License v3.0 (LGPL-3.0).
 *
 * This code was copied from the CPEE project and has been
 * incorporated into this project with modifications.
 */
WFAdaptorManifestation = class extends WFAdaptorManifestationBase {
  constructor(adaptor) {
    super(adaptor);
    this.compact = true;
    this.rotated_labels = false;
  }
}
