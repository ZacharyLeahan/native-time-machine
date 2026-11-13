"""Derive ground and roof samples from the locally cached PASDA 2024 South LAZ."""
import json
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree, Delaunay
from analyze_pickwick_lidar_2024 import read_context, point_in_polygon, BUILDING_LOCAL_FT

ROOT=Path(__file__).resolve().parents[1]
data=read_context(ROOT/'data/raw/27002580PAS_SE_SE.laz',buffer_ft=160)
xy=np.column_stack((data['x'],data['z']))
ground=data['classification']==2
ground_xy=xy[ground]; ground_z=data['elevation'][ground]
tree=cKDTree(ground_xy)
def elevation(points):
    dist,ix=tree.query(points,k=8)
    weights=1/np.maximum(dist,.25)**2
    return (ground_z[ix]*weights).sum(axis=1)/weights.sum(axis=1)
baseline=float(elevation(np.array([[0.,0.]]))[0])
axis=np.arange(-220,221,4,dtype=float)
grid=np.array([[x,z] for z in axis for x in axis])
values=elevation(grid)-baseline
inside=point_in_polygon(xy,BUILDING_LOCAL_FT)
height=data['elevation']-elevation(xy)
roof=inside&(height>8)&(height<40)&(data['classification']==1)
points=xy[roof]; heights=data['elevation'][roof]-baseline
print('roof points',len(points),'height percentiles',np.percentile(heights,[0,10,50,90,100]))
# Fit dominant roof planes with deterministic RANSAC. Reject near-horizontal
# vegetation clusters and retain only broad, tightly supported planar surfaces.
rng=np.random.default_rng(42);remaining=np.arange(len(points));planes=[]
for _ in range(5):
    if len(remaining)<40:break
    best=np.array([],dtype=int);coef=None
    for trial in range(1200):
        ix=rng.choice(remaining,3,replace=False)
        a=np.column_stack((points[ix],np.ones(3)))
        if abs(np.linalg.det(a))<1:continue
        c=np.linalg.solve(a,heights[ix]);slope=np.hypot(*c[:2])
        if not .12<slope<1.5:continue
        residual=abs(np.column_stack((points[remaining],np.ones(len(remaining))))@c-heights[remaining])
        supported=remaining[residual<.22]
        if len(supported)>len(best):best=supported;coef=c
    if len(best)<40:break
    coef=np.linalg.lstsq(np.column_stack((points[best],np.ones(len(best)))),heights[best],rcond=None)[0]
    error=float(np.sqrt(np.mean((np.column_stack((points[best],np.ones(len(best))))@coef-heights[best])**2)))
    planes.append({'coefficients':coef.tolist(),'support':len(best),'rmseFt':round(error,3)})
    remaining=np.setdiff1d(remaining,best)
print('planes',planes)
# Keep roof topology within the county footprint, using interpolated samples
# supported by fitted planes. Save evidence and samples for reproducibility.
roof_grid=np.array([[x,z] for z in np.arange(-63,-11,1.) for x in np.arange(-18,40,1.)])
roof_grid=roof_grid[point_in_polygon(roof_grid,BUILDING_LOCAL_FT)]
roof_grid=np.vstack((roof_grid,BUILDING_LOCAL_FT))
dist,ix=cKDTree(points).query(roof_grid,k=5)
nearest=heights[ix]
predictions=np.array([roof_grid@np.array(p['coefficients'][:2])+p['coefficients'][2] for p in planes])
# Reconstruct two contiguous gabled sections instead of selecting a plane at
# each pixel, which creates spurious dimples at noisy or vegetation returns.
long_axis=np.array([.8660254,.5])
along=points@long_axis
point_predictions=np.array([points@np.array(p['coefficients'][:2])+p['coefficients'][2] for p in planes])
profiles=[np.minimum(point_predictions[0],point_predictions[1]),np.minimum(point_predictions[2],point_predictions[3])]
best=(float('inf'),0.,False)
for split in np.arange(along.min()+3,along.max()-3,.25):
    for reverse in [False,True]:
        side=(along>split)^reverse
        predicted=np.where(side,profiles[1],profiles[0])
        error=float(np.mean(np.minimum(abs(predicted-heights),2)))
        if error<best[0]:best=(error,float(split),reverse)
_,split,reverse=best
section=(roof_grid@long_axis>split)^reverse
roof_heights=np.where(section,np.minimum(predictions[2],predictions[3]),np.minimum(predictions[0],predictions[1]))
print('roof section split',best)
vertices=np.column_stack((roof_grid,roof_heights))
tri=Delaunay(roof_grid).simplices
centers=roof_grid[tri].mean(axis=1)
tri=tri[point_in_polygon(centers,BUILDING_LOCAL_FT)]
result={'source':'PASDA USGS PA 17 County 2024 South, tile 27002580PAS_SE_SE; 2024–2025 acquisition',
 'baselineElevationFt':round(baseline,3),'grid':{'min':-220,'step':4,'size':len(axis),'heights':np.round(values,3).tolist()},
 'roof':{'vertices':np.round(vertices,3).tolist(),'indices':tri.flatten().tolist(),'planes':planes,'sampleCount':len(points),'unmodeledReturns':len(remaining),'sectionSplit':split,'sectionErrorFt':best[0]},
 'groundRangeFt':[round(float(values.min()),2),round(float(values.max()),2)]}
out=ROOT/'src/data/pickwickSurface.json';out.write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
print('baseline',baseline,'terrain range',result['groundRangeFt'],out)
