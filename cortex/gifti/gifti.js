function loadXMLDoc(filename)
{
    if (window.XMLHttpRequest)
	{
	    xhttp=new XMLHttpRequest();
	}
    else // code for IE5 and IE6
	{
	    xhttp=new ActiveXObject("Microsoft.XMLHTTP");
	}
    xhttp.open("GET",filename,false);
    xhttp.send();
    return xhttp.responseXML;
}

var gifti_node = {name:"GIFTI", attr_names:["NumberOfDataArrays","Version"], child_names:["MetaData","LabelTable",["DataArray"]]};
var metadata_node = {name:"MetaData", attr_names:[], child_names:["MD"]};
var labeltable_node = {name:"LabelData", attr_names:[], child_names:["Label"]};
var label_node = {name:"Label", attr_names:["Key","Red","Green","Blue","Alpha"]}
    var dataarray_node = {name:"DataArray", attr_names:["ArrayIndexingOrder","DataType","Dimensionality","Dim0","Dim1","Encoding","Endian","ExternalFileName","ExternalFileOffset","Intent"], child_names:["Data","MetaData",["CoordinateSy\
stemTransformMatrix"]]};
var data_node = {name:"Data", attr_names:[], child_names:[["#text"]]};
var cstransformmatrix_node = {name:"CoordinateSystemTransformMatrix", attr_names:[], child_names:["DataSpace","MatrixData","TransformedSpace"]};
var dataspace_node = {name:"DataSpace", attr_names:[], child_names:[]};
var matrixdata_node = {name:"MatrixData", attr_names:[], child_names:[]};
var transformedspace_node = {name:"TransformedSpace", attr_names:[], child_names:[]}
var md_node = {name:"MD", attr_names:[], child_names:["Name","Value"]}
var name_node = {name:"Name", attr_names:[], child_names:[]}
var value_node = {name:"Value", attr_names:[], child_names:[]}

var all_nodes = [gifti_node, metadata_node, labeltable_node, label_node, dataarray_node, data_node, cstransformmatrix_node, dataspace_node, matrixdata_node, transformedspace_node, md_node, name_node, value_node]

function loadObject(node)
{
    /*if (node.nodeType == 3)
      {
      return node.nodeValue;
      }*/
    var node_name = node.nodeName;
    var node_attributes = node.attributes;
    var node_children = node.childNodes;
    var node_value = node.nodeValue;
    var new_node = {name:node_name, value:node_value};

    var node_type = {};
    for (var i=0; i<all_nodes.length; i++)
    {
	if (new_node.name == all_nodes[i].name)
	{
	    var node_type = all_nodes[i];
	    for (var j=0; j<node_type.attr_names.length; j++)
	    {
		new_node[node_type.attr_names[j]] = "null";
	    }
	    for (var j=0; j<node_type.child_names.length; j++)
	    {
		if (isArray(node_type.child_names[j]))
		{
		    new_node[node_type.child_names[j][0]] = [];
		}
		else
		{
		    new_node[node_type.child_names[j]] = "null";
		}
	    }
	}
    }

    if (node_attributes)
    {
	for (var i=0; i<node_attributes.length; i++)
	{
	    new_node[node_attributes[i].name] = node_attributes[i].value;
	}
    }

    if (node_children)
    {
	for (var i=0; i<node_children.length; i++)
	{
	     /*if (node_children[i].nodeType == 3)
	       {
	       new_node.value = node_children[i].nodeValue;
	       }*/
	    var new_obj = loadObject(node_children[i]);
	    
	    if (isArray(new_node[node_children[i].nodeName]))
	    {
		if (new_obj.name.indexOf("#") > -1)
		{
		    new_node[node_children[i].nodeName].push(new_obj.value);
		}
		else
		{
		    new_node[node_children[i].nodeName].push(new_obj);
		}
	    }
	    else
	    {
		if (new_obj.name.indexOf("#") > -1)
		{
		    new_node.value = new_obj.value;
		}
		else
		{
		    new_node[node_children[i].nodeName] = new_obj;
		}
	    }
	}
    }

    if (node_name == gifti_node.name)
    {
	decompressData(new_node);
    }  
    return new_node;
}

function printObject(obj)
{
    document.write("<br><br>--Printing--");
    for (var x in obj)
    {
	document.write("<br> " + x + ": " + obj[x]);
    }
    for (var x in obj)
    {
	var obj_x = obj[x];
	if (isArray(obj_x))
	{
	    for (var i=0; i<obj_x.length; i++)
	    {
		printObject(obj_x[i]);
	    }
	}
	if (isObject(obj_x))
	{
	    printObject(obj_x);
	}
    }
    document.write("<br>");
}

function isObject(obj)
{
    return obj && obj.constructor.toString().indexOf("Object") > -1;
}

function isArray(arr)
{
    return arr && arr.constructor.toString().indexOf("Array") > -1;
}

function decompressData(gifti_obj)
{
    var data_arrs = gifti_obj.DataArray;
    for (var i = 0; i < data_arrs.length; i++)
    {
	var data_str_arrs = data_arrs[i].Data["#text"];
	var full_data_str = "";
	for (var j = 0; j < data_str_arrs.length; j++)
	{
	    full_data_str = full_data_str.concat(data_str_arrs[j]);
	}
	
	var full_compress_data = atob(full_data_str);
	
	full_compress_data = full_compress_data.split('').map(function(e) {
		return e.charCodeAt(0);});
	
	var inflate = new Zlib.Inflate(full_compress_data);

	var full_coord_data = inflate.decompress();
	
	vertex_coord_array = Float32Array(full_coord_data.buffer);
	gifti_obj.DataArray[i].Data.value = vertex_coord_array;
    }
}
