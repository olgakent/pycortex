function splitverts(geom) {
    var o, ol, i, il, j, jl, k, n = 0, stride, mpts, faceidx, attr, idx, pos;
    var npolys = geom.attributes.index.array.length;
    var newgeom = new THREE.BufferGeometry();
    for (var name in geom.attributes) {
        if (name != "index") {
            attr = geom.attributes[name];
            newgeom.attributes[name] = {itemSize:attr.itemSize, stride:attr.itemSize};
            newgeom.attributes[name].array = new Float32Array(npolys*attr.itemSize);
        }
    }
    newgeom.attributes.index = {itemSize:1, array:new Uint16Array(npolys), stride:1};
    newgeom.attributes.face = {itemSize:1, array:new Float32Array(npolys), stride:1};
    newgeom.attributes.bary = {itemSize:3, array:new Float32Array(npolys*3), stride:3};
    newgeom.attributes.pos1 = {itemSize:3, array:new Float32Array(npolys*3), stride:3};
    newgeom.attributes.pos2 = {itemSize:3, array:new Float32Array(npolys*3), stride:3};
    newgeom.attributes.pos3 = {itemSize:3, array:new Float32Array(npolys*3), stride:3};
    newgeom.morphTargets = [];
    newgeom.morphNormals = [];
    for (i = 0, il = geom.morphTargets.length; i < il; i++) {
        newgeom.morphTargets.push({itemSize:3, array:new Float32Array(npolys*3), stride:3});
        newgeom.morphNormals.push(new Float32Array(npolys*3));
    }
    newgeom.offsets = []
    for (i = 0, il = npolys; i < il; i += 65535) {
        newgeom.offsets.push({start:i, index:i, count:Math.min(65535, il - i)});
    }

    for (o = 0, ol = geom.offsets.length; o < ol; o++) {
        var start = geom.offsets[o].start;
        var count = geom.offsets[o].count;
        var index = geom.offsets[o].index;

        //For each face
        for (j = start, jl = start+count; j < jl; j+=3) {
            //For each vertex
            for (k = 0; k < 3; k++) {
                idx = index + geom.attributes.index.array[j+k];

                for (var name in geom.attributes) {
                    if (name != "index") {
                        attr = geom.attributes[name];
                        for (i = 0, il = attr.itemSize; i < il; i++)
                            newgeom.attributes[name].array[n*il+i] = attr.array[idx*attr.stride+i];
                    }
                }

                for (i = 0, il = geom.morphTargets.length; i < il; i++) {
                    stride = geom.morphTargets[i].stride;
                    newgeom.morphTargets[i].array[n*3+0] = geom.morphTargets[i].array[idx*stride+0];
                    newgeom.morphTargets[i].array[n*3+1] = geom.morphTargets[i].array[idx*stride+1];
                    newgeom.morphTargets[i].array[n*3+2] = geom.morphTargets[i].array[idx*stride+2];
                    newgeom.morphNormals[i][n*3+0] = geom.morphNormals[i][idx*3+0];
                    newgeom.morphNormals[i][n*3+1] = geom.morphNormals[i][idx*3+1];
                    newgeom.morphNormals[i][n*3+2] = geom.morphNormals[i][idx*3+2];
                }

                for (i = 0; i < 3; i++) {
                    pos = newgeom.attributes["pos"+(i+1)].array;
                    idx = index + geom.attributes.index.array[j+i];
                    pos[n*3+0] = geom.attributes.position.array[idx*3+0];
                    pos[n*3+1] = geom.attributes.position.array[idx*3+1];
                    pos[n*3+2] = geom.attributes.position.array[idx*3+2];
                }
                newgeom.attributes.face.array[n] = j / 3;
                newgeom.attributes.bary.array[n*3+k] = 1;
                newgeom.attributes.index.array[n] = n % 65535;
                n++;
            }
        }
    }
    newgeom.computeBoundingBox();
    return newgeom;
}

function makeFlat(uv, flatlims, flatoff, right) {
    var fmin = flatlims[0], fmax = flatlims[1];
    var flat = new Float32Array(uv.length / 2 * 3);
    var norms = new Float32Array(uv.length / 2 * 3);
    for (var i = 0, il = uv.length / 2; i < il; i++) {
        if (right) {
            flat[i*3+1] = flatscale*uv[i*2] + flatoff[1];
            norms[i*3] = 1;
        } else {
            flat[i*3+1] = flatscale*-uv[i*2] + flatoff[1];
            norms[i*3] = -1;
        }
        flat[i*3+2] = flatscale*uv[i*2+1];
        uv[i*2]   = (uv[i*2]   + fmin[0]) / fmax[0];
        uv[i*2+1] = (uv[i*2+1] + fmin[1]) / fmax[1];
    }

    return [flat, norms];
}

function makeHatch(size, linewidth, spacing) {
    //Creates a cross-hatching pattern in canvas for the dropout shading
    if (spacing === undefined)
        spacing = 32;
    if (size === undefined)
        size = 128;
    var canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    ctx.lineWidth = linewidth ? linewidth: 8;
    ctx.strokeStyle = "white";
    for (var i = 0, il = size*2; i < il; i+=spacing) {
        ctx.beginPath();
        ctx.moveTo(i-size, 0);
        ctx.lineTo(i, size);
        ctx.stroke();
        ctx.moveTo(i, 0)
        ctx.lineTo(i-size, size);
        ctx.stroke();
    }

    var tex = new THREE.Texture(canvas);
    tex.needsUpdate = true;
    tex.premultiplyAlpha = true;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipMapLinearFilter;
    return tex;
};

function makeShader(sampler, raw, voxline, volume) {
    var vertShade =  [
    THREE.ShaderChunk[ "map_pars_vertex" ], 
    THREE.ShaderChunk[ "lights_phong_pars_vertex" ],
    THREE.ShaderChunk[ "morphtarget_pars_vertex" ],

    "attribute vec4 auxdat;",
    "attribute vec3 bary;",
    "attribute vec3 pos1;",
    "attribute vec3 pos2;",
    "attribute vec3 pos3;",

    "varying vec3 vViewPosition;",
    "varying vec3 vNormal;",
    "varying float vCurv;",
    "varying float vDrop;",
    "varying float vMedial;",

    "varying vec3 vBC;",
    "varying vec3 v1;",
    "varying vec3 v2;",
    "varying vec3 v3;",

    "void main() {",

        "vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",

        THREE.ShaderChunk[ "map_vertex" ],

        "vDrop = auxdat.x;",
        "vCurv = auxdat.y;",
        "vMedial = auxdat.z;",

        "vBC = bary;",
        "v1 = pos1;",
        "v2 = pos2;",
        "v3 = pos3;",

        "vViewPosition = -mvPosition.xyz;",

        THREE.ShaderChunk[ "morphnormal_vertex" ],

        "vNormal = transformedNormal;",

        THREE.ShaderChunk[ "lights_phong_vertex" ],
        THREE.ShaderChunk[ "morphtarget_vertex" ],
        THREE.ShaderChunk[ "default_vertex" ],

    "}"
    ].join("\n");

    var fragHead = [
    THREE.ShaderChunk[ "map_pars_fragment" ],
    THREE.ShaderChunk[ "lights_phong_pars_fragment" ],

    "uniform int hide_mwall;",

    "uniform mat4 volxfm[2];",
    "uniform vec2 mosaic[2];",
    "uniform vec2 shape[2];",
    "uniform sampler2D data[4];",

    "uniform sampler2D colormap;",
    "uniform float vmin[2];",
    "uniform float vmax[2];",
    "uniform float framemix;",,

    "uniform float curvAlpha;",
    "uniform float curvScale;",
    "uniform float curvLim;",
    "uniform float dataAlpha;",
    "uniform float hatchAlpha;",
    "uniform vec3 hatchColor;",

    "uniform sampler2D hatch;",
    "uniform vec2 hatchrep;",

    "uniform vec3 diffuse;",
    "uniform vec3 ambient;",
    "uniform vec3 emissive;",
    "uniform vec3 specular;",
    "uniform float shininess;",

    "varying float vCurv;",
    "varying float vDrop;",
    "varying float vMedial;",

    "varying vec3 vBC;",
    "varying vec3 v1;",
    "varying vec3 v2;",
    "varying vec3 v3;",

    "vec2 make_uv(vec2 coord, float slice) {",
        "vec2 pos = vec2(mod(slice, mosaic.x), floor(slice / mosaic.x));",
        "return (2.*(pos*shape+coord)+1.) / (2.*mosaic*shape);",
    "}",

    "vec4 trilinear(sampler2D data, vec3 coord) {",
        "vec3 coord = (volxfm[idx] * fid).xyz;",
        "vec4 tex1 = texture2D(data, make_uv(coord.xy, floor(coord.z)));",
        "vec4 tex2 = texture2D(data, make_uv(coord.xy, ceil(coord.z)));",
        'return mix(tex1, tex2, fract(coord.z));',
    "}",

    "vec4 nearest(sampler2D data, int dim, vec3 fid) {",
        "vec3 coord = (volxfm[idx] * fid).xyz;",
        "if (fract(coord.z) > 0.5)",
            "return texture2D(data, make_uv(coord.xy, ceil(coord.z)));",
        "else",
            "return texture2D(data, make_uv(coord.xy, floor(coord.z)));",
    "}",

    "void main() {",
        //Curvature Underlay
        "float curv = clamp(vCurv / curvScale  + .5, curvLim, 1.-curvLim);",
        "gl_FragColor = vec4(vec3(curv)*curvAlpha, curvAlpha);",

        "if (vMedial < .999) {",
            //Finding fiducial location
            "vec3 fid = vBC.x * v1 + vBC.y * v2 + vBC.z * v3;",
            "vec3 coord0 = (volxfm[0]*fid).xyz;",
            "vec3 coord1 = (volxfm[1]*fid).xyz;",
        "",
    ].join("\n");

    var fragMid = "";
    if (voxline) {
        fragMid = [
            "bvec3 edges = lessThan(abs(fract(coord) - vec3(0.5)), vec3(.02));",
            "if (edges.x) gl_FragColor = vec4(1.,0.,0.,1.);",
            "else if (edges.y) gl_FragColor = vec4(0.,.8,0.,1.);",
            "else if (edges.z) gl_FragColor = vec4(0.,0.,1.,1.);",
            "else {\n",
        ].join("\n");
    }
    if (raw) {
        fragMid += "gl_FragColor = mix("+sampler+"(data[0], coord), "+sampler+"(data[2], coord), framemix);"
    } else {
        fragMid += [
            'if (!(data0 <= 0. || 0. <= data0)) {',
                'vColor = vec4(0.);',
            '} else {',
                "float vrange0 = vmax[0] - vmin[0];",
                "float vrange1 = vmax[1] - vmin[1];",
                "float vnorm0 = ("+sampler+"(data[0], coord0) - vmin[0]) / vrange0;",
                "float vnorm1 = ("+sampler+"(data[1], coord1) - vmin[1]) / vrange1;",
                "float vnorm2 = ("+sampler+"(data[2], coord0) - vmin[0]) / vrange0;",
                "float vnorm3 = ("+sampler+"(data[3], coord1) - vmin[1]) / vrange1;",

                "float fnorm0 = mix(vnorm0, vnorm2, framemix);",
                "float fnorm1 = mix(vnorm0, vnorm3, framemix);",

                "vec2 cuv = vec2(clamp(fnorm0, 0., .999), clamp(fnorm1, 0., .999) );",

                "vColor  = texture2D(colormap, cuv);",
        ].join("\n");
    }
    fragMid += "};\n";

    var fragTail = [
            "",
            //Cross hatch / dropout layer
            "float hw = gl_FrontFacing ? hatchAlpha*vDrop : 1.;",
            "vec4 hcolor = hw * vec4(hatchColor, 1.) * texture2D(hatch, vUv*hatchrep);",
            "gl_FragColor = hcolor + gl_FragColor * (1. - hcolor.a);",

            //roi layer
            "vec4 roi = texture2D(map, vUv);",
            "gl_FragColor = roi + gl_FragColor * (1. - roi.a);",

        "} else if (hide_mwall == 1) {",
            "discard;",
        "}",

        THREE.ShaderChunk[ "lights_phong_fragment" ],
    "}"
    ].join("\n");


    return vertShade, fragHead+fragRaw+fragTail;
}